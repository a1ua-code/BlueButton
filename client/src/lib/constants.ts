// Shared wording so every screen uses the same terms (SRS IR-33). Change labels here only.
import type { Availability, PartyStatus } from "../api/types";

export const STATUS_LABEL: Record<PartyStatus, string> = {
  RECRUITING: "Recruiting",
  FULL: "Full",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  OWNED: "Game owned",
  CAFE: "At a board game cafe",
  SEEKING: "Looking for someone to bring it",
  OTHER: "Other",
};

export const AVAILABILITY_HELP: Record<Availability, string> = {
  OWNED: "The host (or a participant) will bring the game.",
  CAFE: "The game will be played at a board game cafe.",
  SEEKING: "One of the participants should bring the game.",
  OTHER: "Rental, borrowing, ... - explain in the note.",
};

export const PARTY_TITLE_MAX = 12; // SRS FR-32
