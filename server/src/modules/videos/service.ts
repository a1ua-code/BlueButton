// Workstream B: YouTube rule-video metadata and admin moderation. NO video files are saved.
// The server-only API key is never returned to the client.
import { and, eq, gte, lt } from "drizzle-orm";
import { db, gameVideos, games, parties } from "../../db";
import { AppError, notFound, conflict } from "../../lib/errors";
import {
  MAX_AGE_MS, VIDEO_ID_RE, WEEK_MS, durationLabel, gameVideoKey,
  normalizeVideo, orderRuleVideos, type NormalizedVideo, type YouTubeVideo,
} from "./utils";

const API_ROOT = "https://www.googleapis.com/youtube/v3";
const SEARCH_COOLDOWN_MS = 60 * 60 * 1000;
const inFlight = new Map<string, Promise<void>>();
const emptyUntil = new Map<string, number>();
let lastPrunedAt = 0;

function youtubeKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new AppError(503, "VIDEO_NOT_CONFIGURED", "Rule videos are not configured yet; open the game rules on YouTube instead.");
  return key;
}

async function requestYouTube<T>(path: "search" | "videos", params: URLSearchParams): Promise<T> {
  params.set("key", youtubeKey());
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/${path}?${params.toString()}`, {
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new AppError(503, "VIDEO_UNAVAILABLE", "YouTube is temporarily unavailable; the rest of BlueButton still works.");
  }
  if (!response.ok) {
    throw new AppError(503, "VIDEO_UNAVAILABLE", "YouTube is unavailable, or its API key/quota needs attention.");
  }
  try {
    return await response.json() as T;
  } catch {
    throw new AppError(503, "VIDEO_UNAVAILABLE", "YouTube returned an invalid response.");
  }
}

async function fetchVideoDetails(ids: string[]): Promise<NormalizedVideo[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    part: "snippet,contentDetails", id: ids.join(","), maxResults: "50",
  });
  const response = await requestYouTube<{ items?: YouTubeVideo[] }>("videos", params);
  if (!Array.isArray(response.items)) throw new AppError(503, "VIDEO_UNAVAILABLE", "Invalid video details from YouTube.");
  return response.items.map(normalizeVideo).filter((row): row is NormalizedVideo => row !== null);
}

async function searchYouTube(gameName: string): Promise<NormalizedVideo[]> {
  // One biased Korean-first search per uncached title; YouTube's relevanceLanguage is a preference, NOT a strict language filter.
  const params = new URLSearchParams({
    part: "id", type: "video", q: `${gameName.slice(0, 100)} board game how to play 규칙`,
    relevanceLanguage: "ko", regionCode: "KR", safeSearch: "moderate", maxResults: "10",
    order: "relevance",
  });
  const response = await requestYouTube<{ items?: { id?: { videoId?: unknown } }[] }>("search", params);
  if (!Array.isArray(response.items)) throw new AppError(503, "VIDEO_UNAVAILABLE", "Invalid search results from YouTube.");
  const ids = [...new Set(response.items.map((r) => r.id?.videoId)
    .filter((id): id is string => typeof id === "string" && VIDEO_ID_RE.test(id)))];
  return fetchVideoDetails(ids);
}

type Row = typeof gameVideos.$inferSelect;
type GameRef = { gameId: string | null; gameName: string };

async function loadRows(key: string): Promise<Row[]> {
  // Never return metadata older than 30 days; it must be deleted or refreshed under YouTube policy.
  return db.select().from(gameVideos).where(and(eq(gameVideos.gameKey, key),
    gte(gameVideos.fetchedAt, new Date(Date.now() - MAX_AGE_MS))));
}

async function persistVideos(key: string, gameId: string | null, videos: NormalizedVideo[]): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const v of videos) {
      await tx.insert(gameVideos).values({
        gameKey: key, gameId, ...v, fetchedAt: now,
      }).onConflictDoUpdate({
        target: [gameVideos.gameKey, gameVideos.youtubeId],
        set: {
          title: v.title, channel: v.channel, url: v.url, thumbnail: v.thumbnail,
          duration: v.duration, language: v.language, fetchedAt: now,
        }, // preserve APPROVED/HIDDEN and pinned through metadata refresh
      });
    }
    // On a successful refresh, remove videos YouTube no longer returns.
    const current = await tx.select({ id: gameVideos.id, youtubeId: gameVideos.youtubeId })
      .from(gameVideos).where(eq(gameVideos.gameKey, key));
    const kept = new Set(videos.map(v => v.youtubeId));
    for (const row of current) {
      if (!kept.has(row.youtubeId)) await tx.delete(gameVideos).where(eq(gameVideos.id, row.id));
    }
  });
}

async function updateIfNeeded(ref: GameRef, key: string): Promise<void> {
  const existing = await loadRows(key);
  if (existing.length && existing.every(r => Date.now() - r.fetchedAt.getTime() < WEEK_MS)) return;
  if (!existing.length && (emptyUntil.get(key) ?? 0) > Date.now()) return;
  // Refetch stored videos with the low-cost videos.list endpoint; only search on first access.
  const videos = existing.length
    ? await fetchVideoDetails(existing.map(r => r.youtubeId))
    : await searchYouTube(ref.gameName);
  await persistVideos(key, ref.gameId, videos);
  if (!videos.length) emptyUntil.set(key, Date.now() + SEARCH_COOLDOWN_MS);
  else emptyUntil.delete(key);
}

function publicVideo(row: Row) {
  return {
    id: row.id,
    youtubeId: row.youtubeId,
    title: row.title,
    channel: row.channel,
    url: row.url,
    thumbnail: row.thumbnail,
    duration: durationLabel(row.duration),
    language: row.language,
    pinned: row.pinned,
    moderationStatus: row.moderationStatus,
  };
}

export async function listRuleVideos(ref: GameRef) {
  // Opportunistic cleanup on active servers; also schedule the included daily prune script.
  if (Date.now() - lastPrunedAt >= 24 * 60 * 60 * 1000) {
    await pruneExpiredVideoMetadata();
    lastPrunedAt = Date.now();
  }
  const key = gameVideoKey(ref.gameId, ref.gameName);
  const running = inFlight.get(key);
  let warning: string | null = null;
  if (running) {
    try { await running; } catch { warning = "YouTube is unavailable; showing previously saved videos, if any."; }
  } else {
    const task = updateIfNeeded(ref, key);
    inFlight.set(key, task);
    try { await task; } catch { warning = "YouTube is unavailable; showing previously saved videos, if any."; }
    finally { inFlight.delete(key); }
  }
  const rows = await loadRows(key);
  // If there is no cache and no API, report a section-local error rather than hiding the cause.
  if (!rows.length && warning) throw new AppError(503, "VIDEO_UNAVAILABLE", warning);
  return {
    gameName: ref.gameName,
    videos: orderRuleVideos(rows.filter(r => r.moderationStatus !== "HIDDEN")).map(publicVideo),
    warning,
  };
}

export async function videosForParty(partyId: string) {
  const [party] = await db.select({ gameId: parties.gameId, gameName: parties.gameName })
    .from(parties).where(eq(parties.id, partyId));
  if (!party) throw notFound("Party");
  return listRuleVideos(party);
}

export async function videosForCatalogGame(gameId: string) {
  const [game] = await db.select({ id: games.id, name: games.name })
    .from(games).where(eq(games.id, gameId));
  if (!game) throw notFound("Game");
  return listRuleVideos({ gameId: game.id, gameName: game.name });
}

// Admin endpoints are provided for team A's dashboard. This module never alters A's routes.
export async function adminListVideos(gameId: string) {
  const [game] = await db.select({ id: games.id, name: games.name })
    .from(games).where(eq(games.id, gameId));
  if (!game) throw notFound("Game");
  const key = gameVideoKey(gameId, game.name);
  const rows = await loadRows(key);
  return { gameName: game.name, videos: orderRuleVideos(rows).map(publicVideo) };
}

export async function adminModerateVideo(videoId: string, input: { status?: "AUTO" | "APPROVED" | "HIDDEN"; pinned?: boolean }) {
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(gameVideos).where(eq(gameVideos.id, videoId)).for("update");
    if (!old) throw notFound("Rule video");
    if (input.pinned === true && input.status === "HIDDEN") throw conflict("HIDDEN_PIN", "Hidden videos cannot be pinned.");
    if (input.pinned === true && (input.status ?? old.moderationStatus) === "HIDDEN") {
      throw conflict("HIDDEN_PIN", "Approve the video before pinning it.");
    }
    if (input.pinned === true) await tx.update(gameVideos).set({ pinned: false }).where(eq(gameVideos.gameKey, old.gameKey));
    const [updated] = await tx.update(gameVideos).set({
      moderationStatus: input.status ?? old.moderationStatus,
      pinned: input.status === "HIDDEN" ? false : input.pinned ?? old.pinned,
    }).where(eq(gameVideos.id, videoId)).returning();
    return publicVideo(updated);
  });
}

export async function adminReplaceVideo(oldId: string, newYouTubeId: string) {
  if (!VIDEO_ID_RE.test(newYouTubeId)) throw new AppError(400, "INVALID_VIDEO_ID", "Enter a valid YouTube video ID.");
  const [old] = await db.select().from(gameVideos).where(eq(gameVideos.id, oldId));
  if (!old) throw notFound("Rule video");
  if (old.youtubeId === newYouTubeId) throw conflict("SAME_VIDEO", "Choose a different YouTube video.");
  const [replacement] = await fetchVideoDetails([newYouTubeId]);
  if (!replacement) throw notFound("Public YouTube video");
  return db.transaction(async tx => {
    const [again] = await tx.select().from(gameVideos).where(eq(gameVideos.id, oldId)).for("update");
    if (!again) throw notFound("Rule video");
    await tx.update(gameVideos).set({ pinned: false }).where(eq(gameVideos.gameKey, again.gameKey));
    await tx.update(gameVideos).set({ moderationStatus: "HIDDEN", pinned: false }).where(eq(gameVideos.id, oldId));
    const [row] = await tx.insert(gameVideos).values({
      gameKey: again.gameKey, gameId: again.gameId, ...replacement,
      moderationStatus: "APPROVED", pinned: true, fetchedAt: new Date(),
    }).onConflictDoUpdate({
      target: [gameVideos.gameKey, gameVideos.youtubeId],
      set: { ...replacement, moderationStatus: "APPROVED", pinned: true, fetchedAt: new Date() },
    }).returning();
    return publicVideo(row);
  });
}

// Call this periodically in production (for example daily via scheduler) to meet the 30-day deletion rule.
export async function pruneExpiredVideoMetadata() {
  await db.delete(gameVideos).where(lt(gameVideos.fetchedAt, new Date(Date.now() - MAX_AGE_MS)));
}
