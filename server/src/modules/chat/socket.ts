// Real-time chat with Socket.IO. OWNER: D
//
// Browser -> server events:
//   "chat:join"  { partyId }          ack: { ok: true } or { ok: false, error }
//   "chat:send"  { partyId, body }    ack: { ok: true, message } or { ok: false, error }
// Server -> browser events:
//   "chat:message"  ChatMessage       a new message in a room you joined
//   "chat:kicked"   { partyId }       you are no longer a member; stop showing the chat
//
// Socket.IO docs: https://socket.io/docs/v4/
import type { Server as HttpServer } from "node:http";
import { parse as parseCookie } from "cookie";
import { Server, type Socket } from "socket.io";
import { config } from "../../config";
import { events } from "../../events";
import { AppError } from "../../lib/errors";
import type { AuthUser } from "../../middleware/auth";
import { findUserBySession, SESSION_COOKIE } from "../auth/service";
import { assertMember, createSystemMessage, sendMessage, type ChatMessage } from "./service";

let io: Server | undefined;
const room = (partyId: string) => `party:${partyId}`;

type Ack = (response: { ok: boolean; error?: string; message?: ChatMessage }) => void;

function errorText(err: unknown) {
  return err instanceof AppError ? err.message : "Something went wrong.";
}

export function initChatSocket(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } });

  // Log the socket in with the same session cookie the REST API uses.
  io.use(async (socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
    const sessionId = cookies[SESSION_COOKIE];
    const user = sessionId ? await findUserBySession(sessionId) : null;
    if (!user) return next(new Error("UNAUTHORIZED"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as AuthUser;

    socket.on("chat:join", async ({ partyId }: { partyId: string }, ack: Ack = () => {}) => {
      try {
        await assertMember(partyId, user.id); // FR-87: members only
        await socket.join(room(partyId));
        ack({ ok: true });
      } catch (err) {
        ack({ ok: false, error: errorText(err) });
      }
    });

    socket.on("chat:leave", ({ partyId }: { partyId: string }) => {
      void socket.leave(room(partyId));
    });

    socket.on(
      "chat:send",
      async ({ partyId, body }: { partyId: string; body: string }, ack: Ack = () => {}) => {
        try {
          const message = await sendMessage(partyId, user, body);
          io!.to(room(partyId)).emit("chat:message", message); // FR-89: no refresh needed
          ack({ ok: true, message });
        } catch (err) {
          ack({ ok: false, error: errorText(err) });
        }
      },
    );
  });

  registerSystemMessages();
  return io;
}

/** Saves a system message and pushes it to everyone currently in the chat. */
export async function postSystemMessage(partyId: string, text: string) {
  const message = await createSystemMessage(partyId, text);
  io?.to(room(partyId)).emit("chat:message", message);
  return message;
}

const STATUS_TEXT = {
  RECRUITING: "Recruiting",
  FULL: "Full",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

/** React to other modules' events with chat messages (FR-106). */
function registerSystemMessages() {
  events.on("party.created", (e) => postSystemMessage(e.partyId, "Party created. Say hi!"));
  // Owner B FR-63: persisted system notification to all current party members.
  // Owner D should review this cross-module listener before merging.
  events.on("party.updated", (e) =>
    postSystemMessage(e.partyId, `Party settings changed: ${e.changes.join("; ")}.`),
  );

  events.on("member.joined", (e) =>
    postSystemMessage(e.partyId, `${e.nickname} joined the party.`),
  );

  events.on("member.left", async (e) => {
    await postSystemMessage(
      e.partyId,
      e.removed ? `${e.nickname} was removed from the party.` : `${e.nickname} left the party.`,
    );
    // FR-92: cut off their live connection to this chat immediately.
    const sockets = await io?.in(room(e.partyId)).fetchSockets();
    for (const s of sockets ?? []) {
      if ((s.data.user as AuthUser).id === e.userId) {
        s.leave(room(e.partyId));
        s.emit("chat:kicked", { partyId: e.partyId });
      }
    }
  });

  events.on("party.status_changed", (e) =>
    postSystemMessage(
      e.partyId,
      `Party status changed: ${STATUS_TEXT[e.from]} → ${STATUS_TEXT[e.to]}.`,
    ),
  );

  events.on("party.cancelled", (e) =>
    postSystemMessage(e.partyId, "The host cancelled this party. The chat is now read-only."),
  );
}
