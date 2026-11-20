// Sample data so everyone can try the app right away. Run with `npm run db:seed`
// (it clears all tables first). `npm run db:reset` rebuilds the whole database and seeds it.
//
// Test accounts (password for all: password123):
//   admin@bluebutton.dev  (admin)
//   alice@kaist.ac.kr
//   bob@kaist.ac.kr
//   chris@kaist.ac.kr
// Password-protected sample party "Wingspan Pro": party password 1234
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import {
  db,
  games,
  messages,
  parties,
  partyMembers,
  pool,
  users,
  type Availability,
} from "./index";

const GAMES: [string, number, number][] = [
  ["Catan", 3, 4],
  ["Ticket to Ride", 2, 5],
  ["Splendor", 2, 4],
  ["Azul", 2, 4],
  ["Codenames", 4, 8],
  ["Carcassonne", 2, 5],
  ["Dixit", 3, 6],
  ["Wingspan", 1, 5],
  ["7 Wonders", 3, 7],
  ["Pandemic", 2, 4],
  ["Bang!", 4, 7],
  ["Halli Galli", 2, 6],
  ["The Mind", 2, 4],
  ["Coup", 2, 6],
  ["Avalon", 5, 10],
  ["Rummikub", 2, 4],
];

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);

async function main() {
  await db.execute(
    sql`TRUNCATE settlement_shares, settlements, messages, bookmarks, party_members, parties,
        reports, sessions, users, games RESTART IDENTITY CASCADE`,
  );

  const gameRows = await db
    .insert(games)
    .values(GAMES.map(([name, minPlayers, maxPlayers]) => ({ name, minPlayers, maxPlayers })))
    .returning();
  const gameId = (name: string) => gameRows.find((g) => g.name === name)!.id;

  const passwordHash = await bcrypt.hash("password123", 10);
  const now = new Date();
  const [, alice, bob, chris] = await db
    .insert(users)
    .values(
      [
        ["admin@bluebutton.dev", "Admin", "ADMIN"] as const,
        ["alice@kaist.ac.kr", "Alice", "USER"] as const,
        ["bob@kaist.ac.kr", "Bob", "USER"] as const,
        ["chris@kaist.ac.kr", "Chris", "USER"] as const,
      ].map(([email, nickname, role]) => ({
        email,
        nickname,
        role,
        passwordHash,
        ageConfirmedAt: now,
        termsAcceptedAt: now,
        emailVerifiedAt: now,
      })),
    )
    .returning();

  async function party(p: {
    host: { id: string };
    members?: { id: string; nickname: string }[];
    title: string;
    game: string;
    capacity: number;
    startAt: Date;
    locationName: string;
    region: string;
    availability: Availability;
    beginnerFriendly?: boolean;
    description?: string;
    password?: string;
    status?: "RECRUITING" | "FULL" | "CLOSED" | "CANCELLED";
  }) {
    const others = p.members ?? [];
    const memberCount = 1 + others.length;
    const [created] = await db
      .insert(parties)
      .values({
        hostId: p.host.id,
        title: p.title,
        gameId: gameId(p.game),
        gameName: p.game,
        capacity: p.capacity,
        startAt: p.startAt,
        locationName: p.locationName,
        region: p.region,
        availability: p.availability,
        beginnerFriendly: p.beginnerFriendly ?? false,
        description: p.description,
        passwordHash: p.password ? await bcrypt.hash(p.password, 10) : null,
        memberCount,
        status: p.status ?? (memberCount >= p.capacity ? "FULL" : "RECRUITING"),
      })
      .returning();
    await db
      .insert(partyMembers)
      .values([
        { partyId: created.id, userId: p.host.id, role: "HOST" },
        ...others.map((m) => ({ partyId: created.id, userId: m.id, role: "PARTICIPANT" as const })),
      ]);
    await db.insert(messages).values([
      { partyId: created.id, type: "SYSTEM", body: "Party created. Say hi!" },
      ...others.map((m) => ({
        partyId: created.id,
        type: "SYSTEM" as const,
        body: `${m.nickname} joined the party.`,
      })),
    ]);
    return created;
  }

  const catan = await party({
    host: alice,
    members: [bob],
    title: "Friday Catan",
    game: "Catan",
    capacity: 4,
    startAt: hoursFromNow(30),
    locationName: "Board game cafe near KAIST",
    region: "Daejeon Yuseong",
    availability: "CAFE",
    beginnerFriendly: true,
    description: "Relaxed game, rules explained at the start. About 2 hours.",
  });
  await db.insert(messages).values([
    { partyId: catan.id, senderId: bob.id, body: "Hi! I have never played Catan, is that ok?" },
    { partyId: catan.id, senderId: alice.id, body: "Of course, I will explain everything :)" },
  ]);

  await party({
    host: bob,
    members: [alice, chris],
    title: "Codenames",
    game: "Codenames",
    capacity: 8,
    startAt: hoursFromNow(52),
    locationName: "N1 building lounge",
    region: "KAIST",
    availability: "OWNED",
    beginnerFriendly: true,
  });

  await party({
    host: chris,
    members: [alice],
    title: "Splendor 1v1",
    game: "Splendor",
    capacity: 2,
    startAt: hoursFromNow(5),
    locationName: "Library cafe",
    region: "KAIST",
    availability: "OWNED",
  });

  await party({
    host: alice,
    title: "Wingspan Pro",
    game: "Wingspan",
    capacity: 4,
    startAt: hoursFromNow(76),
    locationName: "Dorm common room",
    region: "KAIST",
    availability: "SEEKING",
    description: "Experienced players. Looking for someone who owns the European expansion.",
    password: "1234",
  });

  await party({
    host: bob,
    title: "Avalon Night",
    game: "Avalon",
    capacity: 8,
    startAt: hoursFromNow(100),
    locationName: "Eoeun-dong cafe",
    region: "Daejeon Yuseong",
    availability: "CAFE",
    status: "CLOSED",
  });

  await party({
    host: chris,
    members: [bob],
    title: "Past Azul",
    game: "Azul",
    capacity: 4,
    startAt: hoursFromNow(-48),
    locationName: "Library cafe",
    region: "KAIST",
    availability: "OWNED",
  });

  console.log("Seed data created. Log in with alice@kaist.ac.kr / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
