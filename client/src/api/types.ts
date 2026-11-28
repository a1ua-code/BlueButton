// Shapes of the data the server sends. Keep these in sync with the server responses.
// Dates arrive as ISO strings ("2026-11-20T10:00:00.000Z"); use lib/format.ts to display them.

export type Role = "USER" | "ADMIN";
export type PartyStatus = "RECRUITING" | "FULL" | "CLOSED" | "CANCELLED";
export type Availability = "OWNED" | "CAFE" | "SEEKING" | "OTHER";

export type User = {
  id: string;
  email: string;
  nickname: string;
  role: Role;
};

export type Game = {
  id: string;
  name: string;
  minPlayers: number | null;
  maxPlayers: number | null;
};

/** What a party card shows (list, My Parties, bookmarks). */
export type PartySummary = {
  id: string;
  title: string;
  gameName: string;
  capacity: number;
  memberCount: number;
  startAt: string;
  locationName: string;
  region: string | null;
  availability: Availability;
  status: PartyStatus;
  beginnerFriendly: boolean;
  locked: boolean; // password-protected
};

export type PartyMember = { id: string; nickname: string; role: "HOST" | "PARTICIPANT"; noShow: boolean };

export type PartyDetail = PartySummary & {
  description: string | null;
  address: string | null;
  availabilityNote: string | null;
  host: { id: string; nickname: string };
  isMember: boolean;
  isHost: boolean;
  members?: PartyMember[]; // only present for members
};

export type ChatMessage = {
  id: number;
  partyId: string;
  type: "USER" | "SYSTEM" | "SETTLEMENT";
  body: string;
  createdAt: string;
  sender: { id: string; nickname: string } | null;
};
