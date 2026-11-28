// Database smoke test for FR-64/65/66. Run only against the local test database.
// Creates two temporary users and one temporary party; deletes them in finally.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, parties, partyMembers, pool, users } from "../src/db";
import { config } from "../src/config";
import type { AuthUser } from "../src/middleware/auth";
import { transferHost } from "../src/modules/parties/service";
import { leaveParty } from "../src/modules/participation/service";

async function main() {
  // Check the actual DB URL used by the app, not an invented/default port.
  const dbUrl = new URL(config.databaseUrl);
  if (!["localhost", "127.0.0.1", "::1"].includes(dbUrl.hostname)) {
    throw new Error("Refusing to run smoke test against a non-local database.");
  }

  const suffix = randomUUID().slice(0, 8);
  const newUsers = await db.insert(users).values([
    { email: `transfer-a-${suffix}@example.test`, nickname: `ta${suffix}`, passwordHash: "smoke-only",
      ageConfirmedAt: new Date(), termsAcceptedAt: new Date() },
    { email: `transfer-b-${suffix}@example.test`, nickname: `tb${suffix}`, passwordHash: "smoke-only",
      ageConfirmedAt: new Date(), termsAcceptedAt: new Date() },
  ]).returning();
  const [a, b] = newUsers;
  const auth = (u: typeof a): AuthUser => ({ id: u.id, email: u.email, nickname: u.nickname, role: u.role });
  let partyId: string | undefined;
  try {
    const [created] = await db.insert(parties).values({
      hostId: a.id, title: "Transfer", gameName: "Catan", capacity: 2,
      startAt: new Date(Date.now() + 86400_000), locationName: "Local smoke test",
      availability: "OWNED", memberCount: 2, status: "FULL",
    }).returning();
    partyId = created.id;
    await db.insert(partyMembers).values([
      { partyId, userId: a.id, role: "HOST" },
      { partyId, userId: b.id, role: "PARTICIPANT" },
    ]);

    await assert.rejects(() => leaveParty(partyId!, auth(a)), (e: any) => e?.code === "HOST_TRANSFER_REQUIRED");
    await assert.rejects(() => transferHost(partyId!, auth(b), a.id), (e: any) => e?.status === 403);
    await assert.rejects(() => transferHost(partyId!, auth(a), randomUUID()),
      (e: any) => e?.code === "NEW_HOST_NOT_ACTIVE_MEMBER");

    await transferHost(partyId, auth(a), b.id);
    const [p] = await db.select({ hostId: parties.hostId, memberCount: parties.memberCount })
      .from(parties).where(eq(parties.id, partyId));
    assert.equal(p.hostId, b.id);
    assert.equal(p.memberCount, 2);
    const members = await db.select({ userId: partyMembers.userId, role: partyMembers.role })
      .from(partyMembers).where(and(eq(partyMembers.partyId, partyId), inArray(partyMembers.userId, [a.id, b.id])));
    assert.equal(members.find(m => m.userId === a.id)?.role, "PARTICIPANT");
    assert.equal(members.find(m => m.userId === b.id)?.role, "HOST");
    await leaveParty(partyId, auth(a));
    const [afterLeave] = await db.select({ memberCount: parties.memberCount })
      .from(parties).where(eq(parties.id, partyId));
    assert.equal(afterLeave.memberCount, 1);
    const final = await leaveParty(partyId, auth(b));
    assert.equal(final.deleted, true);
    const rows = await db.select({ id: parties.id }).from(parties).where(eq(parties.id, partyId));
    assert.equal(rows.length, 0);
    console.log("PASS FR-64/65/66: guarded leave, atomic transfer, sole-host delete");
  } finally {
    if (partyId) await db.delete(parties).where(eq(parties.id, partyId));
    await db.delete(users).where(inArray(users.id, [a.id, b.id]));
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
