// FR-70 smoke test: local PostgreSQL ONLY. Test data is removed in finally.
// Tests the 12h boundary, half-points, 30-day threshold, suspension, reversal, and 24h leave.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, parties, partyMembers, attendanceIncidents, attendanceSuspensions, pool, users } from "../src/db";
import { config } from "../src/config";
import { AppError } from "../src/lib/errors";
import type { AuthUser } from "../src/middleware/auth";
import { reportNoShow, myAttendance, reverseIncident, liftSuspensions } from "../src/modules/parties/attendanceService";
import { createParty } from "../src/modules/parties/service";
import { joinParty, leaveParty } from "../src/modules/participation/service";

const dbUrl = new URL(config.databaseUrl);
if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname) ||
    dbUrl.port !== "5433" || dbUrl.pathname !== "/bluebutton") {
  throw new Error("Refusing to run: DATABASE_URL is not the default LOCAL BlueButton PostgreSQL on port 5433.");
}

const stamp = randomUUID().slice(0, 8);
const partyIds: string[] = [];
let userIds: string[] = [];
const MS_HOUR = 3_600_000;
const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
async function expectCode(f: () => Promise<unknown>, code: string) {
  try { await f(); } catch (error) {
    if (error instanceof AppError && error.code === code) return;
    throw new Error(`Wanted ${code}, got ${String(error)}`);
  }
  throw new Error(`Expected ${code}, but request was allowed`);
}

async function main() {
  const [host, target, outsider, admin] = await db.insert(users).values(
    ["Host", "Target", "Outside", "Admin"].map((name, i) => ({
      email: `fr70-r-${stamp}-${i}@example.test`,
      nickname: `N${name}${stamp}`.slice(0, 20),
      passwordHash: "no-login", role: i === 3 ? "ADMIN" as const : "USER" as const,
      ageConfirmedAt: new Date(), termsAcceptedAt: new Date(),
    })),
  ).returning();
  userIds = [host.id, target.id, outsider.id, admin.id];
  const auth = (u: typeof host): AuthUser => ({ id: u.id, nickname: u.nickname, email: u.email, role: u.role });

  async function party(offsetHours: number, withTarget = true, cancelled = false) {
    const [row] = await db.insert(parties).values({
      hostId: host.id, title: "FR70 Test", gameName: "Catan", capacity: 2,
      memberCount: withTarget ? 2 : 1,
      status: cancelled ? "CANCELLED" : withTarget ? "FULL" : "RECRUITING",
      startAt: new Date(Date.now() + offsetHours * MS_HOUR),
      locationName: "KAIST", availability: "OWNED",
    }).returning();
    partyIds.push(row.id);
    await db.insert(partyMembers).values([
      { partyId: row.id, userId: host.id, role: "HOST" },
      ...(withTarget ? [{ partyId: row.id, userId: target.id, role: "PARTICIPANT" as const }] : []),
    ]);
    return row.id;
  }

  // 12h cutoff: just outside is free, inside is 0.5.
  const free = await party(13);
  let left = await leaveParty(free, auth(target));
  assert(!left.lateCancellation, "13h cancellation should be free");
  const cancelled = await party(4, true, true);
  left = await leaveParty(cancelled, auth(target));
  assert(!left.lateCancellation, "Cancelled party should not penalize leaving");

  const startBlocked = await party(-2);
  await expectCode(() => leaveParty(startBlocked, auth(target)), "LEAVE_AFTER_24H");
  const old = await party(-27);
  left = await leaveParty(old, auth(target));
  assert(!left.lateCancellation, "Leaving 27h after start is not late-cancelling");
  await expectCode(() => leaveParty(old, auth(host)), "COMPLETED_PARTY_PRESERVED");

  const late1 = await party(5);
  const lateRes1 = await leaveParty(late1, auth(target));
  assert(lateRes1.lateCancellation?.pointsAdded === 0.5, "Late cancellation must add 0.5");
  const report1 = await party(-3);
  await expectCode(() => reportNoShow(report1, auth(outsider), target.id), "FORBIDDEN");
  await expectCode(() => reportNoShow(report1, auth(host), host.id), "CANNOT_REPORT_HOST");
  const firstReport = await reportNoShow(report1, auth(host), target.id);
  assert(firstReport.pointsAdded === 1 && !firstReport.suspendedUntil, "First no-show should add 1 without ban");
  await expectCode(() => reportNoShow(report1, auth(host), target.id), "NO_SHOW_ALREADY_RECORDED");
  const report2 = await party(-4);
  await reportNoShow(report2, auth(host), target.id);
  const late2 = await party(8);
  const lateRes2 = await leaveParty(late2, auth(target));
  assert(!!lateRes2.lateCancellation?.suspendedUntil, "1+1+0.5+0.5 should cause 7d ban");
  const allBans = await db.select().from(attendanceSuspensions).where(eq(attendanceSuspensions.userId, target.id));
  assert(allBans.length === 1 && allBans[0].durationDays === 7, "First ban should be 7 days");

  const nextFuture = await party(40, false);
  await expectCode(() => joinParty(nextFuture, auth(target)), "FORBIDDEN");
  await expectCode(() => createParty(auth(target), {
    title: "Blocked", gameName: "Catan", capacity: 2,
    startAt: new Date(Date.now() + 48 * MS_HOUR), locationName: "KAIST",
    availability: "OWNED", beginnerFriendly: true,
  }), "FORBIDDEN");
  const firstLift = await liftSuspensions(auth(admin), target.id);
  assert(firstLift.lifted === 1, "Admin should be able to lift first ban");
  await joinParty(nextFuture, auth(target));

  // Next 3 NEW points trigger a 10-day suspension; old points must be consumed.
  for (let i = 0; i < 3; i++) {
    const p = await party(-5 - i);
    await reportNoShow(p, auth(host), target.id);
  }
  const laterBans = await db.select().from(attendanceSuspensions)
    .where(eq(attendanceSuspensions.userId, target.id));
  assert(laterBans.length === 2 && laterBans.some(b => b.durationDays === 10),
    "Second suspension should be 10 days, not reusing prior incident points");

  const own = await myAttendance(target.id);
  assert(own.incidents.length >= 7 && own.suspensions.length === 2, "Private user history missing");
  const toReverse = await db.select({ id: attendanceIncidents.id }).from(attendanceIncidents)
    .where(and(eq(attendanceIncidents.userId, target.id), eq(attendanceIncidents.partyId, report2)));
  assert(toReverse.length === 1, "Cannot locate report to reverse");
  const revoked = await reverseIncident(auth(admin), toReverse[0].id, "Incorrect report confirmed by admin");
  assert(revoked.reversed, "Admin reversal failed");
  const after = await myAttendance(target.id);
  assert(after.incidents.some(i => i.id === toReverse[0].id && i.revokedAt), "Reversal not recorded");

  // Regression: late cancellation -> rejoin -> no-show must count at most 1 point.
  const oneParty = await party(5, false);
  await joinParty(oneParty, auth(outsider));
  const late = await leaveParty(oneParty, auth(outsider));
  assert(late.lateCancellation?.pointsAdded === 0.5, "Regression: initial late cancellation not scored");
  await joinParty(oneParty, auth(outsider));
  await db.update(parties).set({ startAt: new Date(Date.now() - MS_HOUR) })
    .where(eq(parties.id, oneParty));
  const noShow = await reportNoShow(oneParty, auth(host), outsider.id);
  assert(noShow.pointsAdded === 0.5, "Regression: net added points should be 0.5");
  const combined = await myAttendance(outsider.id);
  assert(combined.activePoints === 1, "Regression: late cancel + no-show on one party must total 1 point");
  const audit = combined.incidents.filter(i => i.partyTitle === "FR70 Test");
  const olderLate = audit.find(i => i.type === "LATE_CANCEL");
  const latestNoShow = audit.find(i => i.type === "NO_SHOW");
  assert(!!olderLate?.revokedAt && !!latestNoShow && !latestNoShow.revokedAt,
    "Regression: previous late cancellation must remain in audit, but be superseded");
  if (!latestNoShow) {
    throw new Error("Expected NO_SHOW incident in regression test");
  }
  await reverseIncident(auth(admin), latestNoShow.id, "Regression test correction");
  const restored = await myAttendance(outsider.id);
  assert(restored.activePoints === 0.5,
    "Regression: reversing a no-show should restore its superseded late cancellation");

  console.log("PASS FR-70 REVISED: 12h late=0.5, no-show=1, 30d threshold, 7/10d suspensions, admin review, 24h leave, no double penalty");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    if (userIds.length) await db.delete(attendanceIncidents).where(inArray(attendanceIncidents.userId, userIds));
    if (userIds.length) await db.delete(attendanceSuspensions).where(inArray(attendanceSuspensions.userId, userIds));
    if (partyIds.length) await db.delete(parties).where(inArray(parties.id, partyIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  } catch (error) { console.error("FR70 cleanup failed", error); process.exitCode = 1; }
  await pool.end();
});
