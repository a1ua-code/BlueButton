// Checks that a party can never get more members than seats (SRS FR-49, NFR-05).
// 30 users press "Join" on a party with one free seat at the same moment.
// Expected: exactly 1 succeeds, 29 get PARTY_FULL, memberCount = capacity.
//
// Run (database must be running and migrated):  npm run test:race -w server
// It creates its own temporary users/party and deletes them afterwards.
import { eq, inArray, like } from "drizzle-orm";
import { db, parties, pool, users } from "../src/db";
import { createParty } from "../src/modules/parties/service";
import { joinParty } from "../src/modules/participation/service";

const N = 30;
const now = new Date();
const tag = `race${Date.now()}`;

const created = await db
  .insert(users)
  .values(
    Array.from({ length: N + 1 }, (_, i) => ({
      email: `${tag}-${i}@test.local`,
      nickname: `${tag}${i}`.slice(-20),
      passwordHash: "x",
      ageConfirmedAt: now,
      termsAcceptedAt: now,
    })),
  )
  .returning();
const asAuth = (u: (typeof created)[number]) => ({
  id: u.id,
  email: u.email,
  nickname: u.nickname,
  role: u.role,
});
const [host, ...joiners] = created;

const party = await createParty(asAuth(host), {
  title: "Race test",
  gameName: "Test",
  capacity: 2, // host + 1 free seat
  startAt: new Date(Date.now() + 3600_000),
  locationName: "Test",
  availability: "OWNED",
  beginnerFriendly: false,
});

const results = await Promise.allSettled(joiners.map((u) => joinParty(party.id, asAuth(u))));
const ok = results.filter((r) => r.status === "fulfilled").length;
const full = results.filter(
  (r) => r.status === "rejected" && (r.reason as { code?: string }).code === "PARTY_FULL",
).length;
const [after] = await db.select().from(parties).where(eq(parties.id, party.id));

console.log(
  `joined: ${ok}, rejected as full: ${full}, memberCount: ${after.memberCount}/${after.capacity}, status: ${after.status}`,
);
const pass = ok === 1 && full === N - 1 && after.memberCount === 2 && after.status === "FULL";
console.log(pass ? "PASS - no overbooking" : "FAIL");

// clean up
await db.delete(parties).where(eq(parties.id, party.id));
await db.delete(users).where(
  inArray(
    users.id,
    created.map((u) => u.id),
  ),
);
await db.delete(users).where(like(users.email, `${tag}%`));
await pool.end();
process.exit(pass ? 0 : 1);
