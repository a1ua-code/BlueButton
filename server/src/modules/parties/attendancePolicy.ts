// Workstream B: FR-70 attendance scoring and restrictions.
// Client-approved: 12h cancellation window, late=0.5, absent=1.
// Team-agreed: 3 points / rolling 30d, 7 then +3 days (max 30), reset after 180d.
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { attendanceIncidents, attendanceSuspensions, db, parties, type Tx } from "../../db";
import { conflict, forbidden } from "../../lib/errors";

export const DAY_MS = 86_400_000;
export const LATE_CANCELLATION_MS = 12 * 60 * 60 * 1000;
export const PARTY_LEAVE_AFTER_MS = DAY_MS;
const WINDOW_MS = 30 * DAY_MS;
const RESET_MS = 180 * DAY_MS;
const THRESHOLD_HALF_UNITS = 6;

type IncidentKind = "NO_SHOW" | "LATE_CANCEL";

export async function ensureNotSuspended(tx: Tx, userId: string, now = new Date()) {
  const [ban] = await tx.select({ endsAt: attendanceSuspensions.endsAt })
    .from(attendanceSuspensions)
    .where(and(eq(attendanceSuspensions.userId, userId),
      lte(attendanceSuspensions.startsAt, now), gt(attendanceSuspensions.endsAt, now),
      isNull(attendanceSuspensions.revokedAt)))
    .limit(1);
  if (ban) throw forbidden(`New party participation is restricted until ${ban.endsAt.toISOString()}.`);
}

/** Called inside a transaction that already locked the party row and the target user row. */
export async function registerAttendanceIncident(
  tx: Tx, userId: string, partyId: string, kind: IncidentKind,
  occurredAt: Date, partyStartAt: Date,
) {
  // A user can have an audit history of both types, but only ONE effective
  // incident per party. The caller has locked both the party and user rows.
  const previous = await tx.select({
    id: attendanceIncidents.id,
    type: attendanceIncidents.type,
    revokedAt: attendanceIncidents.revokedAt,
    appliedSuspensionId: attendanceIncidents.appliedSuspensionId,
  }).from(attendanceIncidents)
    .where(and(eq(attendanceIncidents.userId, userId), eq(attendanceIncidents.partyId, partyId)));

  // Preserve the original no-duplicate-report behavior even after an admin reversal.
  if (previous.some(row => row.type === kind)) {
    return { pointsAdded: 0, suspendedUntil: null as Date | null, duplicate: true };
  }
  if (kind === "LATE_CANCEL" && previous.some(row => row.type === "NO_SHOW" && !row.revokedAt)) {
    throw conflict("ATTENDANCE_ALREADY_RECORDED", "This party already has a confirmed no-show.");
  }
  const priorLate = kind === "NO_SHOW"
    ? previous.find(row => row.type === "LATE_CANCEL" && !row.revokedAt)
    : undefined;
  if (priorLate) {
    if (priorLate.appliedSuspensionId) {
      // A prior 0.5 point has already supported a suspension. Silently replacing
      // it would corrupt the suspension's evidence and escalation history.
      throw conflict("ATTENDANCE_REVIEW_REQUIRED",
        "An earlier late cancellation was used for a suspension; request an admin review.");
    }
    // Keep the older incident as an auditable, superseded record (0 effective points).
    await tx.update(attendanceIncidents).set({
      revokedAt: new Date(),
      reviewReason: "Automatically superseded by confirmed no-show",
    }).where(eq(attendanceIncidents.id, priorLate.id));
  }

  const [party] = await tx.select({ title: parties.title }).from(parties)
    .where(eq(parties.id, partyId));
  if (!party) throw new Error("Cannot create incident for missing party");
  const pointsHalfUnits = kind === "NO_SHOW" ? 2 : 1;
  // Net points added: changing 0.5 late cancellation to 1 no-show adds only 0.5.
  const netPointsAdded = (pointsHalfUnits - (priorLate ? 1 : 0)) / 2;
  const [incident] = await tx.insert(attendanceIncidents).values({
    userId, partyId, partyTitle: party.title, partyStartAt, type: kind,
    pointsHalfUnits, occurredAt,
  }).returning({ id: attendanceIncidents.id });
  const now = new Date();
  const pending = await tx.select({ id: attendanceIncidents.id, points: attendanceIncidents.pointsHalfUnits })
    .from(attendanceIncidents)
    .where(and(eq(attendanceIncidents.userId, userId),
      gte(attendanceIncidents.occurredAt, new Date(now.getTime() - WINDOW_MS)),
      isNull(attendanceIncidents.appliedSuspensionId), isNull(attendanceIncidents.revokedAt)))
    .orderBy(asc(attendanceIncidents.occurredAt), asc(attendanceIncidents.createdAt));
  const totalPoints = pending.reduce((sum, row) => sum + row.points, 0);
  if (totalPoints < THRESHOLD_HALF_UNITS) {
    return { pointsAdded: netPointsAdded, suspendedUntil: null as Date | null, duplicate: false };
  }

  // A penalty consumes its supporting incidents; the same points cannot cause another ban.
  const [lastSuspension] = await tx.select({ level: attendanceSuspensions.level })
    .from(attendanceSuspensions)
    .where(eq(attendanceSuspensions.userId, userId))
    .orderBy(desc(attendanceSuspensions.createdAt), desc(attendanceSuspensions.endsAt))
    .limit(1);
  const [priorIncident] = await tx.select({ occurredAt: attendanceIncidents.occurredAt })
    .from(attendanceIncidents)
    .where(and(eq(attendanceIncidents.userId, userId), ne(attendanceIncidents.id, incident.id),
      isNull(attendanceIncidents.revokedAt)))
    .orderBy(desc(attendanceIncidents.occurredAt)).limit(1);
  const reset = !priorIncident || priorIncident.occurredAt.getTime() < now.getTime() - RESET_MS;
  const level = reset ? 1 : (lastSuspension?.level ?? 0) + 1;
  const durationDays = Math.min(30, 7 + 3 * (level - 1));

  // A ban may be queued after an existing suspension (e.g. reports for prior meetings).
  const [lastEnd] = await tx.select({ endsAt: attendanceSuspensions.endsAt })
    .from(attendanceSuspensions)
    .where(and(eq(attendanceSuspensions.userId, userId),
      gt(attendanceSuspensions.endsAt, now), isNull(attendanceSuspensions.revokedAt)))
    .orderBy(desc(attendanceSuspensions.endsAt)).limit(1);
  const startsAt = lastEnd ? lastEnd.endsAt : now;
  const endsAt = new Date(startsAt.getTime() + durationDays * DAY_MS);
  const [suspension] = await tx.insert(attendanceSuspensions).values({
    userId, level, durationDays, startsAt, endsAt,
  }).returning({ id: attendanceSuspensions.id });
  // Choose incidents summing to exactly 3.0 points, without losing or splitting 0.5 points.
  // An incident is used for at most one suspension; other unconsumed incidents carry forward.
  const subsets = new Map<number, string[]>([[0, []]]);
  for (const row of pending) {
    for (let sum = THRESHOLD_HALF_UNITS; sum >= row.points; sum--) {
      if (!subsets.has(sum) && subsets.has(sum - row.points)) {
        subsets.set(sum, [...subsets.get(sum - row.points)!, row.id]);
      }
    }
  }
  const selected = subsets.get(THRESHOLD_HALF_UNITS);
  if (!selected) throw new Error("Cannot allocate exactly three penalty points");
  await tx.update(attendanceIncidents).set({ appliedSuspensionId: suspension.id })
    .where(inArray(attendanceIncidents.id, selected));
  return { pointsAdded: netPointsAdded, suspendedUntil: endsAt, duplicate: false };
}
