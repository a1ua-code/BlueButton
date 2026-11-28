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
  address?: string;
  region?: string;
  lat?: number;
  lng?: number;
  availability: Availability;
  availabilityNote?: string;
  description?: string;
  beginnerFriendly: boolean;
  password?: string;
};

export const createParty = (input: CreatePartyInput) =>
  api<{ party: { id: string }; redirectTo: string }>("/parties", { method: "POST", body: input });

export type EditableParty = {
  id: string;
  title: string;
  gameId: string | null;
  gameName: string;
  capacity: number;
  memberCount: number;
  startAt: string;
  locationName: string;
  address: string | null;
  region: string | null;
  availability: Availability;
  availabilityNote: string | null;
  description: string | null;
  beginnerFriendly: boolean;
  status: PartyStatus;
  locked: boolean;
};

export type UpdatePartyInput = CreatePartyInput & {
  removePassword?: boolean;
};

export const fetchPartyForEdit = (id: string) =>
  api<{ party: EditableParty }>(`/parties/${id}/edit`).then((r) => r.party);

export const updateParty = (id: string, input: UpdatePartyInput) =>
  api<{ party: { id: string; status: PartyStatus; changes: string[] } }>(`/parties/${id}`, {
    method: "PATCH", body: input,
  });

export const setPartyStatus = (id: string, status: "RECRUITING" | "CLOSED") =>
  api<{ status: PartyStatus }>(`/parties/${id}/status`, { method: "POST", body: { status } });

export const cancelParty = (id: string) =>
  api<{ status: PartyStatus }>(`/parties/${id}/cancel`, { method: "POST" });

export const transferPartyHost = (id: string, newHostUserId: string) =>
  api<{ transfer: { newHostId: string; newHostNickname: string } }>(`/parties/${id}/transfer-host`, {
    method: "POST", body: { newHostUserId },
  });

export const kickPartyMember = (id: string, userId: string) =>
  api<{ result: { status: PartyStatus; removedUserId: string } }>(
    `/parties/${id}/members/${userId}`, { method: "DELETE" },
  );

export const reportPartyNoShow = (id: string, userId: string) =>
  api<{ result: { userId: string; pointsAdded: number; suspendedUntil: string | null } }>(
    `/parties/${id}/members/${userId}/no-show`, { method: "POST" },
  );

// ---- C: browsing and joining

export type PartyFilters = {
  q?: string;
  region?: string;
  availability?: Availability[];
  noPassword?: boolean;
  includeFull?: boolean;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
  minSeats?: number;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  sort?: "soonest" | "seats" | "distance";
};

export function fetchParties(f: PartyFilters) {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.region) params.set("region", f.region);
  if (f.availability?.length) params.set("availability", f.availability.join(","));
  if (f.noPassword) params.set("noPassword", "true");
  if (f.includeFull) params.set("includeFull", "true");
  if (f.page && f.page > 1) params.set("page", String(f.page));
  if (f.dateFrom) params.set("dateFrom", f.dateFrom);
  if (f.dateTo) params.set("dateTo", f.dateTo);
  if (f.minSeats !== undefined) params.set("minSeats", String(f.minSeats));
  if (f.lat !== undefined) params.set("lat", String(f.lat));
  if (f.lng !== undefined) params.set("lng", String(f.lng));
  if (f.maxDistanceKm !== undefined) params.set("maxDistanceKm", String(f.maxDistanceKm));
  if (f.sort) params.set("sort", f.sort);
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
  api<{ deleted: boolean; status?: PartyStatus; lateCancellation?: { pointsAdded: number; suspendedUntil: string | null } | null }>(`/parties/${id}/leave`, { method: "POST" });

export const addBookmark = (id: string) =>
  api<{ bookmarked: boolean }>(`/parties/${id}/bookmark`, { method: "PUT" });

export const removeBookmark = (id: string) =>
  api<{ bookmarked: boolean }>(`/parties/${id}/bookmark`, { method: "DELETE" });

export const fetchBookmarks = () =>
  api<{ parties: (PartySummary & { bookmarkedAt: string })[] }>("/me/bookmarks");

export const hideParty = (id: string) =>
  api<{ hidden: boolean }>(`/parties/${id}/hide`, { method: "PUT" });

export const unhideParty = (id: string) =>
  api<{ hidden: boolean }>(`/parties/${id}/hide`, { method: "DELETE" });

export const fetchMyParties = () =>
  api<{
    upcoming: (PartySummary & { isHost: boolean })[];
    past: (PartySummary & { isHost: boolean })[];
  }>("/me/parties");
