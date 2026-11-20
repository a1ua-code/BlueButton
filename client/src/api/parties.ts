// Party API calls. Host actions belong to B, list/detail/join/leave to C.
import { api } from "./client";
import type { Availability, Game, PartyDetail, PartyStatus, PartySummary } from "./types";

// ---- B: games and host actions

export const fetchGames = () => api<{ games: Game[] }>("/games").then((r) => r.games);

export type CreatePartyInput = {
  title: string;
  gameId?: string;
  gameName?: string;
  capacity: number;
  startAt: string; // ISO string
  locationName: string;
  region?: string;
  availability: Availability;
  availabilityNote?: string;
  description?: string;
  beginnerFriendly: boolean;
  password?: string;
};

export const createParty = (input: CreatePartyInput) =>
  api<{ party: { id: string }; redirectTo: string }>("/parties", { method: "POST", body: input });

export const setPartyStatus = (id: string, status: "RECRUITING" | "CLOSED") =>
  api<{ status: PartyStatus }>(`/parties/${id}/status`, { method: "POST", body: { status } });

export const cancelParty = (id: string) =>
  api<{ status: PartyStatus }>(`/parties/${id}/cancel`, { method: "POST" });

// ---- C: browsing and joining

export type PartyFilters = {
  q?: string;
  region?: string;
  availability?: Availability[];
  noPassword?: boolean;
  includeFull?: boolean;
  page?: number;
};

export function fetchParties(f: PartyFilters) {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.region) params.set("region", f.region);
  if (f.availability?.length) params.set("availability", f.availability.join(","));
  if (f.noPassword) params.set("noPassword", "true");
  if (f.includeFull) params.set("includeFull", "true");
  if (f.page && f.page > 1) params.set("page", String(f.page));
  return api<{ parties: PartySummary[]; total: number; page: number; pageSize: number }>(
    `/parties?${params}`,
  );
}

export const fetchParty = (id: string) =>
  api<{ party: PartyDetail }>(`/parties/${id}`).then((r) => r.party);

export const joinParty = (id: string, password?: string) =>
  api<{ status: PartyStatus; alreadyMember: boolean; redirectTo: string }>(`/parties/${id}/join`, {
    method: "POST",
    body: { password },
  });

export const leaveParty = (id: string) =>
  api<{ status: PartyStatus }>(`/parties/${id}/leave`, { method: "POST" });

export const fetchMyParties = () =>
  api<{
    upcoming: (PartySummary & { isHost: boolean })[];
    past: (PartySummary & { isHost: boolean })[];
  }>("/me/parties");
