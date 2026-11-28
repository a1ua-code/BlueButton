// Chat messages. OWNER: D  (SRS FR-87 to FR-108)
//
// TODO (D):
//  - images (FR-97), unread counts (FR-100), delete own message within 5 min (FR-101)
//  - mentions (FR-102), mute (FR-94), 2-hour reminder message (FR-108)
import { and, desc, eq, lt } from "drizzle-orm";
import { db, messages, parties, users } from "../../db";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import { isMember } from "../participation/service";

export type ChatMessage = {
  id: number;
  partyId: string;
  type: "USER" | "SYSTEM" | "SETTLEMENT";
  body: string;
  createdAt: Date;
  sender: { id: string; nickname: string } | null;
};

export async function assertMember(partyId: string, userId: string) {
  if (!(await isMember(partyId, userId))) throw forbidden("Only party members can see this chat.");
}

/** Message history, oldest first. Pass `before` (a message id) to load older messages (FR-90). */
export async function listMessages(partyId: string, before?: number, limit = 50) {
  const rows = await db
    .select({
      id: messages.id,
      partyId: messages.partyId,
      type: messages.type,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: users.id,
      senderNickname: users.nickname,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .where(and(eq(messages.partyId, partyId), before ? lt(messages.id, before) : undefined))
    .orderBy(desc(messages.id))
    .limit(limit);

  return rows.reverse().map(({ senderId, senderNickname, ...m }): ChatMessage => ({
    ...m,
    sender: senderId ? { id: senderId, nickname: senderNickname! } : null,
  }));
}

/** Revised FR-93 (client sign-off pending): chat remains writable for members after start. */
async function assertWritable(partyId: string) {
  const [party] = await db
    .select({ status: parties.status, startAt: parties.startAt })
    .from(parties)
    .where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");
  if (party.status === "CANCELLED") {
    throw conflict("CHAT_READ_ONLY", "This chat is read-only now.");
  }
}

export async function sendMessage(
  partyId: string,
  sender: { id: string; nickname: string },
  rawBody: unknown,
): Promise<ChatMessage> {
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body) throw badRequest("Message is empty."); // FR-99
  if (body.length > 2000) throw badRequest("Message is too long (max 2000 characters).");

  await assertMember(partyId, sender.id); // checked on every message, not only when opening the chat
  await assertWritable(partyId);

  const [m] = await db
    .insert(messages)
    .values({ partyId, senderId: sender.id, type: "USER", body })
    .returning();
  return { id: m.id, partyId, type: m.type, body: m.body, createdAt: m.createdAt, sender };
}

/** System messages like "Mina joined the party" (FR-106). Users can't edit or delete these. */
export async function createSystemMessage(partyId: string, body: string): Promise<ChatMessage> {
  const [m] = await db.insert(messages).values({ partyId, type: "SYSTEM", body }).returning();
  return { id: m.id, partyId, type: m.type, body: m.body, createdAt: m.createdAt, sender: null };
}
