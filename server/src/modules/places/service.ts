// Kakao Local API adapter. OWNER: B (FR-123 to FR-129).
// Device coordinates are used only for this request; we never write them to the DB.
import { AppError } from "../../lib/errors";

export type Cafe = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  distanceMeters: number;
  placeUrl: string;
  directionsUrl: string;
};

type KakaoPlace = {
  id?: unknown;
  place_name?: unknown;
  address_name?: unknown;
  road_address_name?: unknown;
  phone?: unknown;
  x?: unknown;
  y?: unknown;
};

type LatLng = { lat: number; lng: number };
const API_ROOT = "https://dapi.kakao.com/v2/local/search";
const CACHE_MS = 5 * 60_000;
const MAX_CACHE = 200;
const placeCache = new Map<string, { expiresAt: number; documents: KakaoPlace[] }>();

function distanceMeters(from: LatLng, to: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (to.lat - from.lat) * rad;
  const dLng = (to.lng - from.lng) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * rad) * Math.cos(to.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742_000 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
}

/** Public, testable mapping: never trust arbitrary URLs in provider responses. */
export function normalizeCafes(documents: KakaoPlace[], origin: LatLng): Cafe[] {
  return documents.flatMap((place) => {
    const lat = Number(place.y);
    const lng = Number(place.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
      typeof place.place_name !== "string" || !place.place_name.trim()) return [];
    const name = place.place_name.trim();
    const rawId = String(place.id ?? "");
    const id = /^\d+$/.test(rawId) ? rawId : `${lat},${lng}`;
    const road = typeof place.road_address_name === "string" ? place.road_address_name : "";
    const address = road || (typeof place.address_name === "string" ? place.address_name : "");
    const phone = typeof place.phone === "string" && place.phone.trim() ? place.phone.trim() : null;
    const directionsUrl = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
    const placeUrl = /^\d+$/.test(rawId)
      ? `https://place.map.kakao.com/${rawId}`
      : `https://map.kakao.com/link/map/${lat},${lng}`;
    return [{ id, name, address, phone, lat, lng,
      distanceMeters: distanceMeters(origin, { lat, lng }), placeUrl, directionsUrl }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name));
}

async function kakaoGet(path: "address" | "keyword", params: URLSearchParams, key: string): Promise<KakaoPlace[]> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/${path}.json?${params.toString()}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(5500),
    });
  } catch {
    throw new AppError(503, "MAP_UNAVAILABLE", "Kakao Maps is temporarily unavailable. Try again later or enter a meeting place manually.");
  }
  if (!response.ok) {
    throw new AppError(503, "MAP_UNAVAILABLE", "Kakao Maps is unavailable or its API quota/key needs attention. You can still enter a meeting place manually.");
  }
  try {
    const json = await response.json() as { documents?: unknown };
    if (!Array.isArray(json.documents)) throw new Error("Malformed response");
    return json.documents as KakaoPlace[];
  } catch {
    throw new AppError(503, "MAP_UNAVAILABLE", "Kakao Maps returned an invalid response. Please try again.");
  }
}

async function resolveManualLocation(address: string, key: string): Promise<LatLng> {
  // Full Korean postal/street addresses work best with the address endpoint.
  const byAddress = await kakaoGet("address", new URLSearchParams({ query: address, size: "1" }), key);
  let first = byAddress[0];
  if (!first) {
    // Landmark names such as 'KAIST' are resolved through place keyword search.
    const byKeyword = await kakaoGet("keyword", new URLSearchParams({ query: address, size: "1" }), key);
    first = byKeyword[0];
  }
  if (!first) {
    throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found. Enter a more specific address or landmark.");
  }
  const lat = Number(first.y);
  const lng = Number(first.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new AppError(503, "MAP_UNAVAILABLE", "Kakao Maps returned invalid coordinates.");
  }
  return { lat, lng };
}

export async function searchBoardGameCafes(input: LatLng | { address: string }): Promise<{
  origin: LatLng & { label: string };
  cafes: Cafe[];
}> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) {
    throw new AppError(503, "MAP_NOT_CONFIGURED", "Cafe search is not configured yet. Add the Kakao REST API key; manual meeting-place entry remains available.");
  }
  const manual = "address" in input;
  const position = manual ? await resolveManualLocation(input.address, key) : input;

  // Only rounded coordinates form a cache key; precise user coordinates are not retained.
  const cacheKey = `${position.lat.toFixed(3)}:${position.lng.toFixed(3)}`;
  const cached = placeCache.get(cacheKey);
  let documents: KakaoPlace[];
  if (cached && cached.expiresAt > Date.now()) {
    documents = cached.documents;
  } else {
    const params = new URLSearchParams({
      query: "보드게임카페", x: String(position.lng), y: String(position.lat),
      radius: "10000", size: "15", sort: "distance",
    });
    documents = await kakaoGet("keyword", params, key);
    if (placeCache.size >= MAX_CACHE) placeCache.clear();
    placeCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, documents });
  }
  return {
    origin: { ...position, label: manual ? input.address : "Your selected location" },
    cafes: normalizeCafes(documents, position),
  };
}
