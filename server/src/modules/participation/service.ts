// Finding, viewing, joining and leaving parties. OWNER: C
// SRS FR-40 to FR-60, FR-71 to FR-86.
//
// TODO (C):
//  - more filters/sorting: date range, distance, remaining seats (FR-43, FR-53)
//  - bookmarks list with live status (FR-74 to FR-79), hide party (FR-84)
//  - host leaving rules (FR-65, FR-66), overlap warning (FR-71, FR-72)
//  - waitlist, recommendations, question to host (FR-55, FR-85, FR-86 - MAY)
import bcrypt from "bcryptjs";
import { and, asc, count, eq, gt, ilike, inArray, isNull, type SQL } from "drizzle-orm";
import {
  db,
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

type SummaryRow = { passwordHash: string | null } & Record<string, unknown>;

function toSummary<T extends SummaryRow>({ passwordHash, ...rest }: T) {
  return { ...rest, locked: passwordHash !== null };
}

export type PartyFilters = {
  q?: string;
  gameId?: string;
  region?: string;
  availability?: string[];
  noPassword?: boolean;
  includeFull?: boolean;
  page?: number;
};

/** Party list (FR-40 to FR-45). Default: recruiting parties that have not started, soonest first. */
export async function listParties(f: PartyFilters) {
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
  ];
  const where = and(...conditions);
  const page = Math.max(1, f.page ?? 1);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(parties)
      .where(where)
      .orderBy(asc(parties.startAt), asc(parties.id))
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
  const { hostId, hostNickname, ...rest } = party;
  return {
    ...toSummary(rest),
    host: { id: hostId, nickname: hostNickname },
    isMember,
    isHost: viewer?.id === hostId,
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
  return { status: result.status, alreadyMember: !result.joined };
}

/** A participant leaves (FR-60). The host must transfer the host role or cancel instead (FR-65). */
export async function leaveParty(partyId: string, user: AuthUser) {
  const result = await db.transaction(async (tx) => {
    const party = await lockParty(tx, partyId);
    const member = await findMembership(tx, partyId, user.id);
    if (!member || member.state !== "ACTIVE")
      throw conflict("NOT_MEMBER", "You are not in this party.");
    if (member.role === "HOST") {
      throw conflict("HOST_CANNOT_LEAVE", "Transfer the host role or cancel the party first.");
    }

    await tx
      .update(partyMembers)
      .set({ state: "LEFT", leftAt: new Date() })
      .where(and(eq(partyMembers.partyId, partyId), eq(partyMembers.userId, user.id)));
    const memberCount = party.memberCount - 1;
    const status = statusAfterCountChange(party.status, memberCount, party.capacity);
    await tx.update(parties).set({ memberCount, status }).where(eq(parties.id, partyId));
    return { status, previousStatus: party.status };
  });

  events.emit("member.left", { partyId, userId: user.id, nickname: user.nickname, removed: false });
  if (result.previousStatus !== result.status) {
    events.emit("party.status_changed", {
      partyId,
      from: result.previousStatus,
      to: result.status,
    });
  }
  return { status: result.status };
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
