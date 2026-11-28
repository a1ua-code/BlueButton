// Pure transformations; never trust arbitrary video IDs/URLs from a provider payload.
export const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type YouTubeVideo = {
  id?: unknown;
  snippet?: {
    title?: unknown;
    channelTitle?: unknown;
    defaultLanguage?: unknown;
    defaultAudioLanguage?: unknown;
  };
  contentDetails?: { duration?: unknown };
};

export type NormalizedVideo = {
  youtubeId: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string;
  duration: string | null;
  language: string;
};

export function gameVideoKey(gameId: string | null, gameName: string): string {
  return gameId ? `game:${gameId}` : `custom:${gameName.trim().toLocaleLowerCase("en-US")}`;
}

export function normalizeVideo(video: YouTubeVideo): NormalizedVideo | null {
  if (typeof video.id !== "string" || !VIDEO_ID_RE.test(video.id)) return null;
  const rawTitle = video.snippet?.title;
  if (typeof rawTitle !== "string" || !rawTitle.trim()) return null;
  const lang = video.snippet?.defaultAudioLanguage ?? video.snippet?.defaultLanguage;
  const language = typeof lang === "string" && /^(ko|en)(-|$)/i.test(lang)
    ? lang.toLowerCase().slice(0, 10)
    : /[\uac00-\ud7a3]/.test(rawTitle) ? "ko" : "unknown";
  const duration = video.contentDetails?.duration;
  return {
    youtubeId: video.id,
    title: rawTitle.trim().slice(0, 300),
    channel: typeof video.snippet?.channelTitle === "string"
      ? video.snippet.channelTitle.slice(0, 180) : "YouTube",
    url: `https://www.youtube.com/watch?v=${video.id}`,
    thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    duration: typeof duration === "string" && /^P(T(?:\d+H)?(?:\d+M)?(?:\d+S)?)$/.test(duration)
      ? duration : null,
    language,
  };
}

export function durationLabel(iso: string | null): string | null {
  if (!iso) return null;
  const found = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!found) return null;
  const h = Number(found[1] ?? 0), m = Number(found[2] ?? 0), s = Number(found[3] ?? 0);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function orderRuleVideos<T extends { language: string; pinned: boolean; moderationStatus: string; title: string }>(rows: T[]): T[] {
  const rank = (row: T) => row.language.startsWith("ko") ? 0 : row.language.startsWith("en") ? 1 : 2;
  return [...rows].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) ||
    Number(b.moderationStatus === "APPROVED") - Number(a.moderationStatus === "APPROVED") ||
    rank(a) - rank(b) || a.title.localeCompare(b.title));
}
