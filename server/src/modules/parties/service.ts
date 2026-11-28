// Creating and managing parties (the host side). OWNER: B
// SRS FR-27 to FR-39, FR-61 to FR-70.
//
// TODO (B):
//  - transfer host (FR-64, FR-65), kick participant (FR-69), no-show + penalties (FR-70)
//  - map/address picker and cafe suggestions (FR-37, FR-38, FR-123 to FR-129)
//  - recurring parties (FR-39, MAY)
import bcrypt from "bcryptjs";
import { and, asc, eq } from "drizzle-orm";
import { db, games, parties, partyMembers, users, type PartyStatus } from "../../db";
import { events } from "../../events";
import { conflict, forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";
import type { CreatePartyInput, EditPartyInput } from "./schemas";
import { statusAfterCountChange, statusOnReopen } from "./status";

export async function listGames() {
  return db.select().from(games).orderBy(asc(games.name));
}

export async function createParty(host: AuthUser, input: CreatePartyInput) {
  let gameName = input.gameName ?? "";
  if (input.gameId) {
    const [game] = await db.select().from(games).where(eq(games.id, input.gameId));
    if (!game) throw notFound("Game");
    gameName = game.name;
  }
  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : null; // FR-34

  // One transaction: the party and its first member (the host) are created together (FR-35).
  const party = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(parties)
      .values({
        hostId: host.id,
        title: input.title,
        gameId: input.gameId ?? null,
        gameName,
        capacity: input.capacity,
        startAt: input.startAt,
        locationName: input.locationName,
        address: input.address,
        region: input.region,
        availability: input.availability,
        availabilityNote: input.availabilityNote,
        description: input.description,
        beginnerFriendly: input.beginnerFriendly,
        passwordHash,
        status: "RECRUITING",
        memberCount: 1,
      })
      .returning();
    await tx.insert(partyMembers).values({ partyId: created.id, userId: host.id, role: "HOST" });
    return created;
  });

  events.emit("party.created", { partyId: party.id, hostId: host.id });
  return party;
}

/** Throws unless the user is the party's host or an admin (FR-18, SR-05). */
export async function getPartyAsHost(partyId: string, user: AuthUser) {
  const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");
  if (party.hostId !== user.id && user.role !== "ADMIN") {
    throw forbidden("Only the host can manage this party.");
  }
  return party;
}

/** The edit form may only receive ordinary settings, not private password hashes. */
export async function getPartyForEdit(partyId: string, user: AuthUser) {
  const p = await getPartyAsHost(partyId, user);
  return {
    id: p.id,
    title: p.title,
    gameId: p.gameId,
    gameName: p.gameName,
    capacity: p.capacity,
    memberCount: p.memberCount,
    startAt: p.startAt,
    locationName: p.locationName,
    address: p.address,
    region: p.region,
    availability: p.availability,
    availabilityNote: p.availabilityNote,
    description: p.description,
    beginnerFriendly: p.beginnerFriendly,
    status: p.status,
    locked: !!p.passwordHash,
  };
}

/** FR-61 to FR-63: one locked transaction protects capacity and join/edit races. */
export async function editParty(partyId: string, user: AuthUser, input: EditPartyInput) {
  let gameName = input.gameName ?? "";
  if (input.gameId) {
    const [game] = await db.select().from(games).where(eq(games.id, input.gameId));
    if (!game) throw notFound("Game");
    gameName = game.name;
  }
  // Hash outside the row lock so concurrent joins are not blocked by bcrypt work.
  const newPasswordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;
  const result = await db.transaction(async (tx) => {
    const [old] = await tx.select().from(parties).where(eq(parties.id, partyId)).for("update");
    if (!old) throw notFound("Party");
    if (old.hostId !== user.id && user.role !== "ADMIN") {
      throw forbidden("Only the host or admin may edit this party.");
    }
    if (old.status === "CANCELLED") throw conflict("PARTY_CANCELLED", "Cancelled parties cannot be edited.");
    if (input.capacity < old.memberCount) {
      throw conflict("CAPACITY_TOO_SMALL", `There are already ${old.memberCount} members.`);
    }

    // No sensitive information (password or account data) is placed in notifications.
    const changes: string[] = [];
    const note = (label: string, before: string, after: string) => {
      if (before !== after) changes.push(`${label}: ${before} → ${after}`);
    };
    const kst = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short", hour12: false,
      }).format(date) + " KST";
    note("Board game", old.gameName, gameName);
    note("Date/time", kst(old.startAt), kst(input.startAt));
    note("Meeting place", old.locationName, input.locationName);
    note("Address", old.address ?? "", input.address ?? "");
    note("Region", old.region ?? "", input.region ?? "");
    note("Game availability", old.availability, input.availability);
    note("Availability details", old.availabilityNote ?? "", input.availabilityNote ?? "");

    const nextStatus = statusAfterCountChange(old.status, old.memberCount, input.capacity);
    await tx.update(parties).set({
      title: input.title,
      gameId: input.gameId ?? null,
      gameName,
      capacity: input.capacity,
      startAt: input.startAt,
      locationName: input.locationName,
      address: input.address || null,
      region: input.region || null,
      availability: input.availability,
      availabilityNote: input.availabilityNote || null,
      description: input.description || null,
      beginnerFriendly: input.beginnerFriendly,
      passwordHash: input.removePassword ? null : (newPasswordHash ?? old.passwordHash),
      status: nextStatus,
    }).where(eq(parties.id, partyId));
    return { previousStatus: old.status, nextStatus, changes };
  });

  // Notify after commit, never before. The chat subscriber records the change for all members.
  if (result.changes.length) {
    events.emit("party.updated", { partyId, changes: result.changes });
  }
  if (result.previousStatus !== result.nextStatus) {
    events.emit("party.status_changed", {
      partyId, from: result.previousStatus, to: result.nextStatus,
    });
  }
  return { id: partyId, status: result.nextStatus, changes: result.changes };
}

/** FR-64: transfer ownership and both member roles in one locked transaction. */
export async function transferHost(partyId: string, user: AuthUser, newHostUserId: string) {
  const result = await db.transaction(async (tx) => {
    // All join/leave/edit operations lock this same party row first (NFR-17).
    const [party] = await tx.select({ hostId: parties.hostId, status: parties.status })
      .from(parties).where(eq(parties.id, partyId)).for("update");
    if (!party) throw notFound("Party");
    // FR-64 is host-only (not admin impersonation).
    if (party.hostId !== user.id) throw forbidden("Only the current host can transfer the host role.");
    if (party.status === "CANCELLED") throw conflict("PARTY_CANCELLED", "Cannot transfer a cancelled party.");
    if (newHostUserId === user.id) throw conflict("ALREADY_HOST", "Choose another member.");

    const [target] = await tx.select({
      id: partyMembers.userId, state: partyMembers.state, nickname: users.nickname,
    }).from(partyMembers).innerJoin(users, eq(users.id, partyMembers.userId))
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, newHostUserId)));
    if (!target || target.state !== "ACTIVE") {
      throw conflict("NEW_HOST_NOT_ACTIVE_MEMBER", "Select an active participant of this party.");
    }

    const [oldMember] = await tx.select({ role: partyMembers.role, state: partyMembers.state })
      .from(partyMembers).where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, user.id)));
    if (!oldMember || oldMember.state !== "ACTIVE" || oldMember.role !== "HOST") {
      throw conflict("HOST_MEMBERSHIP_INVALID", "The current host membership is inconsistent.");
    }

    await tx.update(partyMembers).set({ role: "PARTICIPANT" })
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, user.id)));
    await tx.update(partyMembers).set({ role: "HOST" })
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, newHostUserId)));
    await tx.update(parties).set({ hostId: newHostUserId }).where(eq(parties.id, partyId));
    return { newHostId: newHostUserId, newHostNickname: target.nickname };
  });

  // Chat subscribers are notified only after the transaction commits (FR-106).
  events.emit("host.transferred", {
    partyId, previousHostId: user.id, previousHostNickname: user.nickname,
    newHostId: result.newHostId, newHostNickname: result.newHostNickname,
  });
  return result;
}

/** Host switches between Recruiting and Closed (FR-67). */
export async function setStatusByHost(
  partyId: string,
  user: AuthUser,
  wanted: "RECRUITING" | "CLOSED",
) {
  const party = await getPartyAsHost(partyId, user);
  if (party.status === "CANCELLED") throw conflict("PARTY_CANCELLED", "This party was cancelled.");

  const next: PartyStatus =
    wanted === "CLOSED" ? "CLOSED" : statusOnReopen(party.memberCount, party.capacity);
  if (next === party.status) return next;

  await db.update(parties).set({ status: next }).where(eq(parties.id, partyId));
  events.emit("party.status_changed", { partyId, from: party.status, to: next });
  return next;
}

/** Host cancels the party (FR-68). Participants are told through events (chat + email). */
export async function cancelParty(partyId: string, user: AuthUser) {
  const party = await getPartyAsHost(partyId, user);
  if (party.status === "CANCELLED") return party.status;

  await db
    .update(parties)
    .set({ status: "CANCELLED", cancelledAt: new Date() })
    .where(eq(parties.id, partyId));
  events.emit("party.cancelled", { partyId, byUserId: user.id });
  return "CANCELLED" as const;
}
