// Domain events: how modules tell each other "something happened" without importing
// each other's code. Emit AFTER the database change is committed.
//
//   events.emit("member.joined", { partyId, userId, nickname });   // C emits
//   events.on("member.joined", async (e) => { ... });               // D listens
//
// To add an event, add a line to the Events type below. TypeScript then checks every
// emit and listener for you.
import { EventEmitter } from "node:events";
import type { PartyStatus } from "./db/schema";

export type Events = {
  "party.created": { partyId: string; hostId: string };
  "party.updated": { partyId: string; changes: string[] };
  "party.cancelled": { partyId: string; byUserId: string };
  "party.status_changed": { partyId: string; from: PartyStatus; to: PartyStatus };
  "host.transferred": { partyId: string; previousHostId: string; previousHostNickname: string; newHostId: string; newHostNickname: string };
  "member.joined": { partyId: string; userId: string; nickname: string };
  "member.left": { partyId: string; userId: string; nickname: string; removed: boolean };
};

type Listener<K extends keyof Events> = (payload: Events[K]) => unknown;

class EventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof Events>(name: K, payload: Events[K]) {
    this.emitter.emit(name, payload);
  }

  on<K extends keyof Events>(name: K, listener: Listener<K>) {
    // A failing listener must never crash the request that emitted the event.
    this.emitter.on(name, (payload: Events[K]) => {
      Promise.resolve(listener(payload)).catch((err) =>
        console.error(`[events] listener for "${name}" failed:`, err),
      );
    });
  }
}

export const events = new EventBus();
