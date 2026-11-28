// Database schema for B&B - the single source of truth for all tables.
//
// To change the database:
//   1. Edit this file.
//   2. npm run db:generate   -> writes a new SQL file in server/drizzle/
//   3. npm run db:migrate    -> applies it to your local database
//   4. Commit schema.ts AND the new file in server/drizzle/ together.
// Teammates then only run `npm run db:migrate` after pulling.
//
// Names: write camelCase here; the database columns become snake_case automatically.
// Ownership: each table lists the workstream that owns it. Only the owner's module
// writes to it; other modules call the owner's service functions.
//
// Drizzle docs: https://orm.drizzle.team/docs/sql-schema-declaration
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uniqueIndex,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------- enums

export const roleEnum = pgEnum("role", ["USER", "ADMIN"]);
export const userStatusEnum = pgEnum("user_status", [
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
  "DEACTIVATED",
]);
export const partyStatusEnum = pgEnum("party_status", [
  "RECRUITING",
  "FULL",
  "CLOSED",
  "CANCELLED",
]);
/** SRS FR-31: OWNED = host/participant brings it, CAFE = played at a cafe,
 *  SEEKING = looking for someone to bring it, OTHER = rental etc. (see availabilityNote) */
export const availabilityEnum = pgEnum("availability", ["OWNED", "CAFE", "SEEKING", "OTHER"]);
export const memberRoleEnum = pgEnum("member_role", ["HOST", "PARTICIPANT"]);
/** REMOVED = kicked by the host, cannot rejoin (FR-69) */
export const memberStateEnum = pgEnum("member_state", ["ACTIVE", "LEFT", "REMOVED"]);
export const attendanceIncidentEnum = pgEnum("attendance_incident", ["NO_SHOW", "LATE_CANCEL"]);
export const messageTypeEnum = pgEnum("message_type", ["USER", "SYSTEM", "SETTLEMENT"]);
export const settlementStatusEnum = pgEnum("settlement_status", ["OPEN", "COMPLETED", "CANCELLED"]);
export const shareStatusEnum = pgEnum("share_status", ["UNPAID", "PAID", "CONFIRMED"]);
export const reportTargetEnum = pgEnum("report_target", ["PARTY", "USER", "MESSAGE", "VIDEO"]);
export const reportStatusEnum = pgEnum("report_status", ["OPEN", "RESOLVED", "DISMISSED"]);

export type PartyStatus = (typeof partyStatusEnum.enumValues)[number];
export type Availability = (typeof availabilityEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];

// ---------------------------------------------------------------- A: identity

/** Owner: A */
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  nickname: varchar({ length: 20 }).notNull().unique(),
  bio: text(),
  profileImageUrl: text(),
  role: roleEnum().notNull().default("USER"),
  status: userStatusEnum().notNull().default("ACTIVE"),
  emailVerifiedAt: timestamp({ withTimezone: true }),
  ageConfirmedAt: timestamp({ withTimezone: true }).notNull(), // FR-03
  termsAcceptedAt: timestamp({ withTimezone: true }).notNull(), // FR-04
  failedLoginCount: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

/** Owner: A. One row per logged-in browser; the id is the random value in the cookie. */
export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

/** Owner: A */
export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id),
    targetType: reportTargetEnum().notNull(),
    targetId: text().notNull(),
    reason: text().notNull(),
    detail: text(),
    status: reportStatusEnum().notNull().default("OPEN"),
    resolution: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.createdAt)],
);

// ---------------------------------------------------------------- B: parties

/** Owner: B. Predefined game list (FR-30); admins add games without code changes (NFR-22). */
export const games = pgTable("games", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  minPlayers: integer(),
  maxPlayers: integer(),
});

/** Owner: B (create/edit/status/cancel). C updates memberCount/status inside join/leave. */
export const parties = pgTable(
  "parties",
  {
    id: uuid().primaryKey().defaultRandom(),
    hostId: uuid()
      .notNull()
      .references(() => users.id),
    title: varchar({ length: 12 }).notNull(), // FR-32: 1-12 characters
    gameId: uuid().references(() => games.id),
    gameName: text().notNull(), // copy of the game's name, or a custom name not in the list
    capacity: integer().notNull(), // includes the host
    startAt: timestamp({ withTimezone: true }).notNull(),
    locationName: text().notNull(),
    address: text(),
    region: text(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    availability: availabilityEnum().notNull(),
    availabilityNote: text(),
    description: text(),
    beginnerFriendly: boolean().notNull().default(false),
    passwordHash: text(), // null = no password
    status: partyStatusEnum().notNull().default("RECRUITING"),
    memberCount: integer().notNull().default(0), // kept in sync by join/leave transactions
    cancelledAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.status, t.startAt),
    index().on(t.hostId),
    // Safety net: the database itself refuses a party with more members than seats (NFR-05).
    check("parties_capacity_check", sql`${t.capacity} >= 2`),
    check("parties_member_count_check", sql`${t.memberCount} BETWEEN 0 AND ${t.capacity}`),
  ],
);

// ---------------------------------------------------------------- C: participation

/** Owner: C */
export const partyMembers = pgTable(
  "party_members",
  {
    partyId: uuid()
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: memberRoleEnum().notNull().default("PARTICIPANT"),
    state: memberStateEnum().notNull().default("ACTIVE"),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp({ withTimezone: true }),
    noShow: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.partyId, t.userId] }), index().on(t.userId, t.state)],
);

/** Owner: C */
export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    partyId: uuid()
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.partyId] })],
);

/** Owner: C. A hidden party is excluded from this user's browsing results. */
export const hiddenParties = pgTable(
  "hidden_parties",
  {
    userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
    partyId: uuid().notNull().references(() => parties.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.partyId] })],
);

/** Owner B. Duration and escalation history are kept even after expiry. */
export const attendanceSuspensions = pgTable("attendance_suspensions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id),
  level: integer().notNull(),
  durationDays: integer().notNull(),
  startsAt: timestamp({ withTimezone: true }).notNull(),
  endsAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
  revokedAt: timestamp({ withTimezone: true }),
  revokedById: uuid().references(() => users.id),
}, (t) => [index("attendance_ban_user_start_idx").on(t.userId, t.startsAt)]);

/** Owner B. Points use half-unit integers: late cancellation=1, no-show=2. */
export const attendanceIncidents = pgTable("attendance_incidents", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id),
  // Keep historical penalties even when a pre-start party is deleted.
  partyId: uuid().references(() => parties.id, { onDelete: "set null" }),
  partyTitle: text().notNull(),
  partyStartAt: timestamp({ withTimezone: true }).notNull(),
  type: attendanceIncidentEnum().notNull(),
  pointsHalfUnits: integer().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
  appliedSuspensionId: uuid().references(() => attendanceSuspensions.id, { onDelete: "set null" }),
  revokedAt: timestamp({ withTimezone: true }),
  revokedById: uuid().references(() => users.id),
  reviewReason: text(),
}, (t) => [
  uniqueIndex("attendance_one_incident_type_per_party").on(t.userId, t.partyId, t.type),
  index("attendance_user_occurred_idx").on(t.userId, t.occurredAt),
]);

// ---------------------------------------------------------------- D: chat and settlements

/** Owner: D. senderId is null for system messages. */
export const messages = pgTable(
  "messages",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    partyId: uuid()
      .notNull()
      .references(() => parties.id, { onDelete: "cascade" }),
    senderId: uuid().references(() => users.id),
    type: messageTypeEnum().notNull().default("USER"),
    body: text().notNull(),
    imageUrl: text(),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.partyId, t.id)],
);

/** Owner: D */
export const settlements = pgTable("settlements", {
  id: uuid().primaryKey().defaultRandom(),
  partyId: uuid()
    .notNull()
    .references(() => parties.id, { onDelete: "cascade" }),
  requesterId: uuid()
    .notNull()
    .references(() => users.id),
  item: text().notNull(),
  totalKrw: integer().notNull(),
  receivingInfo: text().notNull(),
  status: settlementStatusEnum().notNull().default("OPEN"),
  createdAt: createdAt(),
});

/** Owner: D */
export const settlementShares = pgTable(
  "settlement_shares",
  {
    settlementId: uuid()
      .notNull()
      .references(() => settlements.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    amountKrw: integer().notNull(),
    status: shareStatusEnum().notNull().default("UNPAID"),
  },
  (t) => [primaryKey({ columns: [t.settlementId, t.userId] })],
);

// ---------------------------------------------------------------- relations
// These let you load related rows in one call, e.g.
//   db.query.parties.findFirst({ where: eq(parties.id, id), with: { host: true } })

export const usersRelations = relations(users, ({ many }) => ({
  hostedParties: many(parties),
  memberships: many(partyMembers),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  host: one(users, { fields: [parties.hostId], references: [users.id] }),
  game: one(games, { fields: [parties.gameId], references: [games.id] }),
  members: many(partyMembers),
  messages: many(messages),
}));

export const partyMembersRelations = relations(partyMembers, ({ one }) => ({
  party: one(parties, { fields: [partyMembers.partyId], references: [parties.id] }),
  user: one(users, { fields: [partyMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  party: one(parties, { fields: [messages.partyId], references: [parties.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));
