import { api } from "./client";

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

export type CafeSearch = {
  origin: { lat: number; lng: number; label: string };
  cafes: Cafe[];
};

/** POST avoids putting precise device coordinates in URL/query logs. */
export function searchBoardGameCafes(location: { lat: number; lng: number } | { address: string }) {
  return api<CafeSearch>("/places/search", { method: "POST", body: location });
}
