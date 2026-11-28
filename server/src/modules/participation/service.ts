// Finding, viewing, joining and leaving parties. OWNER: C
// SRS FR-40 to FR-60, FR-71 to FR-86.
//
import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNull, lte, notInArray, sql, type SQL } from "drizzle-orm";
import {
  bookmarks,
  db,
  hiddenParties,
  parties,
  partyMembers,
  users,
  type Availability,
  type PartyStatus,
  type Tx,
} from "../../db";
import { events } from "../../events";
import { AppError, conflict, forbidden, notFound } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";
import { statusAfterCountChange } from "../parties/status";

const PAGE_SIZE = 20;

// The columns a party card needs. passwordHash is only used to compute `locked` and is
// never sent to the browser.
const summaryColumns = {
  id: parties.id,
  title: parties.title,
  gameName: parties.gameName,
  capacity: parties.capacity,
  memberCount: parties.memberCount,
  startAt: parties.startAt,
  locationName: parties.locationName,
  region: parties.region,
  availability: parties.availability,
  status: parties.status,
  beginnerFriendly: parties.beginnerFriendly,
  passwordHash: parties.passwordHash,
};

type SummaryRow = { passwordHash: string | null; capacity: number; memberCount: number } & Record<string, unknown>;

function toSummary<T extends SummaryRow>({ passwordHash, capacity, memberCount, ...rest }: T) {
  return { ...rest, capacity, memberCount, remainingSeats: capacity - memberCount, locked: passwordHash !== null };
}

export type PartyFilters = {
  q?: string;
  gameId?: string;
  region?: string;
  availability?: string[];
  noPassword?: boolean;
  includeFull?: boolean;
  page?: number;
  dateFrom?: Date;
  dateTo?: Date;
  minSeats?: number;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  sort?: "soonest" | "seats" | "distance";
  viewerId?: string;
};

/** Party list (FR-40 to FR-45). Default: recruiting parties that have not started, soonest first. */
export async function listParties(f: PartyFilters) {
  // Clamp the spherical cosine argument to avoid floating point errors near the poles.
  const distance = f.lat !== undefined && f.lng !== undefined
    ? sql<number>`6371 * acos(least(1, greatest(-1, sin(radians(${f.lat})) * sin(radians(${parties.lat})) + cos(radians(${f.lat})) * cos(radians(${parties.lat})) * cos(radians(${parties.lng}) - radians(${f.lng})))))`
    : undefined;
  const statuses: PartyStatus[] = f.includeFull ? ["RECRUITING", "FULL", "CLOSED"] : ["RECRUITING"];
  const conditions: (SQL | undefined)[] = [
    inArray(parties.status, statuses),
    gt(parties.startAt, new Date()),
    f.q ? ilike(parties.title, `%${f.q}%`) : undefined,
    f.gameId ? eq(parties.gameId, f.gameId) : undefined,
    f.region ? ilike(parties.region, `%${f.region}%`) : undefined,
    f.availability?.length
      ? inArray(parties.availability, f.availability as Availability[])
      : undefined,
    f.noPassword ? isNull(parties.passwordHash) : undefined,
    f.dateFrom ? gte(parties.startAt, f.dateFrom) : undefined,
    f.dateTo ? lte(parties.startAt, f.dateTo) : undefined,
    f.minSeats !== undefined ? gte(sql<number>`${parties.capacity} - ${parties.memberCount}`, f.minSeats) : undefined,
    f.maxDistanceKm !== undefined && distance ? lte(distance, f.maxDistanceKm) : undefined,
    f.viewerId ? notInArray(parties.id, db.select({ partyId: hiddenParties.partyId }).from(hiddenParties).where(eq(hiddenParties.userId, f.viewerId))) : undefined,
  ];
  const where = and(...conditions);
  const page = Math.max(1, f.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(parties)
      .where(where)
      .orderBy(
        f.sort === "seats" ? desc(sql<number>`${parties.capacity} - ${parties.memberCount}`) :
        f.sort === "distance" && distance ? asc(distance) : asc(parties.startAt),
        asc(parties.startAt), asc(parties.id),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(parties).where(where),
  ]);
  return { parties: rows.map(toSummary), total, page, pageSize: PAGE_SIZE };
}

/** Party detail page (FR-46). The member list is only shown to members. */
export async function getPartyDetail(partyId: string, viewer?: AuthUser) {
  const [party] = await db
    .select({
      ...summaryColumns,
      description: parties.description,
      address: parties.address,
      availabilityNote: parties.availabilityNote,
      hostId: parties.hostId,
      hostNickname: users.nickname,
    })
    .from(parties)
    .innerJoin(users, eq(users.id, parties.hostId))
    .where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");

  const members = await db
    .select({ id: users.id, nickname: users.nickname, role: partyMembers.role })
    .from(partyMembers)
    .innerJoin(users, eq(users.id, partyMembers.userId))
    .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.state, "ACTIVE")))
    .orderBy(asc(partyMembers.joinedAt));

  const isMember = !!viewer && members.some((m) => m.id === viewer.id);
  const [bookmark] = viewer ? await db.select({ partyId: bookmarks.partyId }).from(bookmarks)
    .where(and(eq(bookmarks.userId, viewer.id), eq(bookmarks.partyId, partyId))) : [];
  const { hostId, hostNickname, ...rest } = party;
  return {
    ...toSummary(rest),
    host: { id: hostId, nickname: hostNickname },
    isMember,
    isHost: viewer?.id === hostId,
    isBookmarked: !!bookmark,
    members: isMember ? members : undefined,
  };
}

/** Locks the party row until the transaction ends, so two joins can't both take the last seat. */
async function lockParty(tx: Tx, partyId: string) {
  const [party] = await tx
    .select({
      status: parties.status,
      capacity: parties.capacity,
      memberCount: parties.memberCount,
      startAt: parties.startAt,
    })
    .from(parties)
    .where(eq(parties.id, partyId))
    .for("update"); // SELECT ... FOR UPDATE
  if (!party) throw notFound("Party");
  return party;
}

async function findMembership(tx: Tx, partyId: string, userId: string) {
  const [m] = await tx
    .select()
    .from(partyMembers)
    .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));
  return m;
}

/**
 * Join a party (FR-47 to FR-52). The member count can never go above capacity, even when
 * many people press Join at the same moment (FR-49, NFR-05) - see SDD section 7.1.
 */
export async function joinParty(partyId: string, user: AuthUser, password?: string) {
  const [pre] = await db
    .select({ passwordHash: parties.passwordHash })
    .from(parties)
    .where(eq(parties.id, partyId));
  if (!pre) throw notFound("Party");

  // Check the party password BEFORE locking (hashing is slow; keep the lock short).
  if (pre.passwordHash) {
    const ok = password ? await bcrypt.compare(password, pre.passwordHash) : false;
    if (!ok) {
      throw new AppError(403, "WRONG_PASSWORD", "Incorrect party password.", {
        password: "Incorrect password.",
      });
    }
  }

  const result = await db.transaction(async (tx) => {
    const party = await lockParty(tx, partyId);

    const existing = await findMembership(tx, partyId, user.id);
    if (existing?.state === "ACTIVE") return { joined: false as const, status: party.status }; // FR-51
    if (existing?.state === "REMOVED") throw forbidden("The host removed you from this party.");

    if (party.status === "CANCELLED")
      throw conflict("PARTY_CANCELLED", "This party was cancelled.");
    if (party.startAt <= new Date())
      throw conflict("PARTY_STARTED", "This party has already started.");
    if (party.status === "CLOSED") throw conflict("PARTY_CLOSED", "The host closed this party.");
    if (party.status === "FULL" || party.memberCount >= party.capacity) {
      throw conflict("PARTY_FULL", "Sorry, this party just filled up.");
    }

    if (existing) {
      // Rejoining after leaving earlier
      await tx
        .update(partyMembers)
        .set({ state: "ACTIVE", joinedAt: new Date(), leftAt: null })
        .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, user.id)));
    } else {
      await tx.insert(partyMembers).values({ partyId, userId: user.id, role: "PARTICIPANT" });
    }

    const memberCount = party.memberCount + 1;
    const status = statusAfterCountChange(party.status, memberCount, party.capacity); // FR-50
    await tx.update(parties).set({ memberCount, status }).where(eq(parties.id, partyId));
    return { joined: true as const, status, previousStatus: party.status };
  });

  // Tell other modules only after the transaction has committed.
  if (result.joined) {
    events.emit("member.joined", { partyId, userId: user.id, nickname: user.nickname });
    if (result.previousStatus !== result.status) {
      events.emit("party.status_changed", {
        partyId,
        from: result.previousStatus,
        to: result.status,
      });
    }
  }
  // Start times within two hours are a useful warning; party duration is not stored.
  const [target] = await db.select({ startAt: parties.startAt }).from(parties).where(eq(parties.id, partyId));
  const overlaps = target ? await db
    .select({ id: parties.id, title: parties.title, startAt: parties.startAt })
    .from(partyMembers)
    .innerJoin(parties, eq(parties.id, partyMembers.partyId))
    .where(and(eq(partyMembers.userId, user.id), eq(partyMembers.state, "ACTIVE"),
      sql`${parties.id} <> ${partyId}`,
      gte(parties.startAt, new Date(target.startAt.getTime() - 2 * 60 * 60 * 1000)),
      lte(parties.startAt, new Date(target.startAt.getTime() + 2 * 60 * 60 * 1000)),
      gt(parties.startAt, new Date()), sql`${parties.status} <> 'CANCELLED'`))
    .orderBy(asc(parties.startAt)) : [];
  return { status: result.status, alreadyMember: !result.joined, overlapWarning: overlaps.length > 0, overlaps };
}

/** A participant leaves (FR-60). The host must transfer the host role or cancel instead (FR-65). */
export async function leaveParty(partyId: string, user: AuthUser) {
  const result = await db.transaction(async (tx) => {
    const party = await lockParty(tx, partyId);
    const member = await findMembership(tx, partyId, user.id);
    if (!member || member.state !== "ACTIVE")
      throw conflict("NOT_MEMBER", "You are not in this party.");
    if (member.role === "HOST") {
      // FR-65: do not orphan parties with participants.
      if (party.memberCount !== 1) {
        throw conflict("HOST_TRANSFER_REQUIRED", "Transfer the host role to another member before leaving.");
      }
      // FR-66: sole-member host leaving deletes the whole party. Cascading FKs
      // remove memberships/messages/bookmarks/settlements in the same transaction.
      await tx.delete(parties).where(eq(parties.id, partyId));
      return { deleted: true as const, status: party.status, previousStatus: party.status };
    }

    await tx
      .update(partyMembers)
      .set({ state: "LEFT", leftAt: new Date() })
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, user.id)));
    const memberCount = party.memberCount - 1;
    const status = statusAfterCountChange(party.status, memberCount, party.capacity);
    await tx.update(parties).set({ memberCount, status }).where(eq(parties.id, partyId));
    return { deleted: false as const, status, previousStatus: party.status };
  });

  if (result.deleted) return { deleted: true as const };

  events.emit("member.left", { partyId, userId: user.id, nickname: user.nickname, removed: false });
  if (result.previousStatus !== result.status) {
    events.emit("party.status_changed", {
      partyId,
      from: result.previousStatus,
      to: result.status,
    });
  }
  return { deleted: false as const, status: result.status };
}

/** My Parties page (FR-56 to FR-58): upcoming soonest first, past (and cancelled) separately. */
export async function myParties(user: AuthUser) {
  const rows = await db
    .select({ ...summaryColumns, role: partyMembers.role })
    .from(partyMembers)
    .innerJoin(parties, eq(parties.id, partyMembers.partyId))
    .where(and(eq(partyMembers.userId, user.id), eq(partyMembers.state, "ACTIVE")))
    .orderBy(asc(parties.startAt));

  const now = new Date();
  const all = rows.map(({ role, ...p }) => ({ ...toSummary(p), isHost: role === "HOST" }));
  const isPast = (p: (typeof all)[number]) => p.startAt <= now || p.status === "CANCELLED";
  return {
    upcoming: all.filter((p) => !isPast(p)),
    past: all.filter(isPast).reverse(),
  };
}

/** Used by chat (D) to decide who may read and send messages (FR-87, SR-06). */
export async function isMember(partyId: string, userId: string) {
  const [m] = await db
    .select({ state: partyMembers.state })
    .from(partyMembers)
    .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, userId)));
  return m?.state === "ACTIVE";
}

export async function addBookmark(partyId: string, userId: string) {
  const [party] = await db.select({ id: parties.id }).from(parties).where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");
  await db.insert(bookmarks).values({ partyId, userId }).onConflictDoNothing();
  return { bookmarked: true };
}

export async function removeBookmark(partyId: string, userId: string) {
  await db.delete(bookmarks).where(and(eq(bookmarks.partyId, partyId), eq(bookmarks.userId, userId)));
  return { bookmarked: false };
}

/** Reads current party status, including full, closed, and cancelled bookmarks. */
export async function listBookmarks(userId: string) {
  const rows = await db.select({ ...summaryColumns, bookmarkedAt: bookmarks.createdAt })
    .from(bookmarks).innerJoin(parties, eq(parties.id, bookmarks.partyId))
    .where(eq(bookmarks.userId, userId)).orderBy(desc(bookmarks.createdAt));
  return { parties: rows.map(({ bookmarkedAt, ...party }) => ({ ...toSummary(party), bookmarkedAt })) };
}

export async function hideParty(partyId: string, userId: string) {
  const [party] = await db.select({ id: parties.id }).from(parties).where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");
  await db.insert(hiddenParties).values({ partyId, userId }).onConflictDoNothing();
  return { hidden: true };
}

export async function unhideParty(partyId: string, userId: string) {
  await db.delete(hiddenParties).where(and(eq(hiddenParties.partyId, partyId), eq(hiddenParties.userId, userId)));
  return { hidden: false };
}
