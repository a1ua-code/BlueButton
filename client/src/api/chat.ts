// Chat API + the live socket connection. OWNER: D
import { io, type Socket } from "socket.io-client";
import { api } from "./client";
import type { ChatMessage } from "./types";

export const fetchMessages = (partyId: string, before?: number) =>
  api<{ messages: ChatMessage[] }>(
    `/parties/${partyId}/messages${before ? `?before=${before}` : ""}`,
  ).then((r) => r.messages);

// One shared socket for the whole app. It logs in with the same cookie as the API.
let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) socket = io({ withCredentials: true, autoConnect: false });
  if (!socket.connected) socket.connect();
  return socket;
}

/** Call after logout so the next user gets a fresh connection. */
export function disconnectSocket() {
  socket?.disconnect();
  socket = undefined;
}

type Ack = { ok: boolean; error?: string; message?: ChatMessage };

export function joinRoom(partyId: string) {
  return new Promise<Ack>((resolve) => getSocket().emit("chat:join", { partyId }, resolve));
}

export function sendChatMessage(partyId: string, body: string) {
  return new Promise<Ack>((resolve) => getSocket().emit("chat:send", { partyId, body }, resolve));
}
