// The party status rules in one place (SDD section 7.2). OWNER: B
//
//   RECRUITING <-> FULL     automatic, from memberCount vs capacity
//   RECRUITING <-> CLOSED   host switches by hand (FR-67)
//   any        ->  CANCELLED host cancels (FR-68); final, never changes again
//   "COMPLETED" is not stored: it means "not cancelled and start time has passed".
import type { PartyStatus } from "../../db/schema";

/** Status after the number of members changed (join, leave, kick, capacity edit). */
export function statusAfterCountChange(
  current: PartyStatus,
  memberCount: number,
  capacity: number,
): PartyStatus {
  if (current === "CLOSED" || current === "CANCELLED") return current; // host decisions win
  return memberCount >= capacity ? "FULL" : "RECRUITING";
}

/** Status when the host reopens a closed party. */
export function statusOnReopen(memberCount: number, capacity: number): PartyStatus {
  return memberCount >= capacity ? "FULL" : "RECRUITING";
}

export function isCompleted(party: { status: PartyStatus; startAt: Date }, now = new Date()) {
  return party.status !== "CANCELLED" && party.startAt <= now;
}
