import { api } from "./client";

export type RuleVideo = {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
  duration: string | null;
  language: string;
  pinned: boolean;
  moderationStatus: "AUTO" | "APPROVED" | "HIDDEN";
};
export type RuleVideosResponse = {
  gameName: string;
  videos: RuleVideo[];
  warning: string | null;
};

export const fetchPartyRuleVideos = (partyId: string) =>
  api<RuleVideosResponse>(`/parties/${encodeURIComponent(partyId)}/videos`);
