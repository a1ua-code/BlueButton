// Location search for Create Party, FR-37, FR-38 and FR-127.
// Reuses the server-side Kakao adapter; no new API keys or location storage.
import { useCallback, useRef, useState } from "react";
import { errorMessage } from "../api/client";
import { searchBoardGameCafes, type Cafe, type CafeSearch } from "../api/places";
import { KakaoCafeMap } from "./KakaoCafeMap";
import { Button, TextField } from "./ui";

export type SelectedLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type SearchOrigin = "address" | "device";

export function PartyLocationPicker({
  cafeMode,
  onPick,
}: {
  cafeMode: boolean;
  onPick: (location: SelectedLocation) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CafeSearch | null>(null);
  const [originMode, setOriginMode] = useState<SearchOrigin>("address");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  // Ignore stale responses if the user starts another request while one is in flight.
  const requestId = useRef(0);

  const pickCafe = useCallback((cafe: Cafe) => {
    setSelectedId(cafe.id);
    onPick({ name: cafe.name, address: cafe.address || cafe.name, lat: cafe.lat, lng: cafe.lng });
    setNotice(`Selected ${cafe.name} as the meeting place. You can still edit the fields below.`);
  }, [onPick]);

  async function search(location: { address: string } | { lat: number; lng: number }, mode: SearchOrigin) {
    const currentId = ++requestId.current;
    setWorking(true);
    setNotice("");
    try {
      const next = await searchBoardGameCafes(location);
      if (currentId !== requestId.current) return;
      setResult(next);
      setOriginMode(mode);
      setSelectedId(null);
      if (!next.cafes.length) {
        setNotice("Location found, but no nearby board-game cafes were returned. You can still select the address or enter a meeting place manually.");
      }
    } catch (error) {
      if (currentId !== requestId.current) return;
      setResult(null);
      setNotice(`${errorMessage(error)} Manual meeting-place entry is still available.`);
    } finally {
      if (currentId === requestId.current) setWorking(false);
    }
  }

  function searchAddress() {
    const address = query.trim();
    if (address.length < 2) {
      setNotice("Enter an address or landmark (at least 2 characters). Alternatively, type a meeting place below.");
      return;
    }
    void search({ address }, "address");
  }

  function findNearMe() {
    // Consent is requested only after this click; device coordinates are never saved to a party.
    if (!navigator.geolocation) {
      setNotice("Your browser cannot provide location. Enter an address manually.");
      return;
    }
    const currentId = ++requestId.current;
    setWorking(true);
    setNotice("Requesting location permission...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId.current !== currentId) return;
        // Coordinates are only sent to the places search service, never to createParty.
        void search({ lat: coords.latitude, lng: coords.longitude }, "device");
      },
      () => {
        if (requestId.current !== currentId) return;
        setWorking(false);
        setNotice("Location permission was denied or unavailable. Search by address or enter a place manually.");
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
    );
  }

  const selectedCafe = result?.cafes.find((cafe) => cafe.id === selectedId);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="font-semibold text-slate-800">Find a meeting place on Kakao Maps <span className="text-xs font-normal text-slate-500">(optional)</span></h3>
        <p className="mt-1 text-sm text-slate-600">
          Search an address or landmark, then choose the location. {cafeMode
            ? "Because you selected ‘Board game cafe’, you can also choose a nearby cafe from the map or list."
            : "Select ‘Board game cafe’ under game availability to choose a nearby cafe."}
          {" "}You can always enter the meeting place manually below.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <TextField label="Search address or landmark" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchAddress(); } }}
            placeholder="e.g. 대전 유성구 대학로 291 or KAIST" />
        </div>
        <Button type="button" onClick={searchAddress} variant="secondary" loading={working}>Find location</Button>
      </div>
      {cafeMode && (
        <Button type="button" variant="secondary" onClick={findNearMe} disabled={working}>
          Find cafes near me (permission required)
        </Button>
      )}
      {notice && <p role="status" className="rounded-lg bg-white p-3 text-sm text-slate-700">{notice}</p>}

      {result && (
        <div className="space-y-4">
          <KakaoCafeMap result={result} selectedCafe={selectedCafe}
            onSelectCafe={cafeMode ? pickCafe : undefined} />
          {originMode === "address" && (
            <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Search location: {result.origin.label}</p>
                <p className="text-xs text-slate-500">Choose this address itself, without selecting a cafe.</p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => {
                onPick({ name: result.origin.label, address: result.origin.label,
                  lat: result.origin.lat, lng: result.origin.lng });
                setSelectedId(null);
                setNotice("Search address selected as the meeting location.");
              }}>Use this address</Button>
            </div>
          )}
          {cafeMode && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Nearby board-game cafes ({result.cafes.length})</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {result.cafes.map((cafe) => (
                  <div key={cafe.id} className={`rounded-lg border bg-white p-3 ${selectedId === cafe.id ? "border-brand-600" : "border-slate-200"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{cafe.name}</p>
                        <p className="text-xs text-slate-600">{cafe.address || "Address not listed"} · {(cafe.distanceMeters / 1000).toFixed(1)} km away</p>
                        <a href={cafe.placeUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-brand-700 hover:underline">View on Kakao Maps</a>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => pickCafe(cafe)}>
                        {selectedId === cafe.id ? "Selected" : "Choose cafe"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">You can click a cafe marker on the map to select it.</p>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Device location, if permitted, is used only to find nearby cafes. It is never automatically set as a party venue.
            Only a meeting place you explicitly choose will be saved with the party.
          </p>
        </div>
      )}
    </div>
  );
}
