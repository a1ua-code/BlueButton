// FR-69 integration smoke test. Run only against local development PostgreSQL.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, parties, partyMembers, pool, users } from "../src/db";
import { kickParticipant } from "../src/modules/parties/service";
import { joinParty } from "../src/modules/participation/service";
import type { AuthUser } from "../src/middleware/auth";
import { AppError } from "../src/lib/errors";

async function rejectWith(fn: () => Promise<unknown>, code: string) {
  try { await fn(); } catch (error) {
    if (error instanceof AppError && error.code === code) return;
    throw new Error(`Expected ${code}, got ${String(error)}`);
  }
  throw new Error(`Expected ${code}, but operation succeeded`);
}

const uid = randomUUID().slice(0, 8);
let partyId: string | undefined;
let userIds: string[] = [];
async function main() {
  const names = ["Host", "Target", "Other"];
  const created = await db.insert(users).values(names.map((name, i) => ({
    email: `fr69-${uid}-${i}@example.test`,
    nickname: `K${name}${uid}`.slice(0, 20),
    passwordHash: "not-used-by-smoke-test",
    ageConfirmedAt: new Date(),
    termsAcceptedAt: new Date(),
  }))).returning();
  userIds = created.map((u) => u.id);
  const [host, target, outsider] = created;
  const asUser = (u: typeof host): AuthUser => ({
    id: u.id, email: u.email, nickname: u.nickname, role: "USER",
  });
  const [party] = await db.insert(parties).values({
    hostId: host.id, title: "Kick test", gameName: "Catan", capacity: 2,
    memberCount: 2, status: "FULL", startAt: new Date(Date.now() + 86400000),
    locationName: "KAIST", availability: "OWNED",
  }).returning();
  partyId = party.id;
  await db.insert(partyMembers).values([
    { partyId, userId: host.id, role: "HOST" },
    { partyId, userId: target.id, role: "PARTICIPANT" },
  ]);

  await rejectWith(() => kickParticipant(partyId!, asUser(outsider), target.id), "FORBIDDEN");
  await rejectWith(() => kickParticipant(partyId!, asUser(host), host.id), "CANNOT_KICK_HOST");

  const result = await kickParticipant(partyId, asUser(host), target.id);
  if (result.status !== "RECRUITING") throw new Error(`Expected RECRUITING; got ${result.status}`);
  const [p] = await db.select().from(parties).where(eq(parties.id, partyId));
  const [m] = await db.select().from(partyMembers).where(and(
    eq(partyMembers.partyId, partyId), eq(partyMembers.userId, target.id),
  ));
  if (!p || p.memberCount !== 1 || p.status !== "RECRUITING" || m?.state !== "REMOVED") {
    throw new Error("Kick did not correctly update party/membership state");
  }
  await rejectWith(() => joinParty(partyId!, asUser(target)), "FORBIDDEN");
  await rejectWith(() => kickParticipant(partyId!, asUser(host), target.id), "MEMBER_NOT_ACTIVE");
  console.log("PASS FR-69: host-only kick, memberCount/status, persistent rejoin block");
}

main().catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => {
    // Clean up even on assertion failure; never truncate or seed any other tables.
    try {
      if (partyId) await db.delete(parties).where(eq(parties.id, partyId));
      if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    } catch (err) { console.error("Smoke cleanup failed:", err); process.exitCode = 1; }
    await pool.end();
  });
