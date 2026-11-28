// Board-game cafes: location consent, manual lookup, Kakao map/list, directions.
// OWNER: B (FR-123 to FR-129). Device location is never stored in browser storage.
import { useState } from "react";
import { errorMessage } from "../api/client";
import { searchBoardGameCafes, type Cafe, type CafeSearch } from "../api/places";
import { KakaoCafeMap } from "../components/KakaoCafeMap";
import { Button, Card, PageHeader, TextField } from "../components/ui";

function distanceLabel(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function CafesPage() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<CafeSearch | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function runSearch(location: { lat: number; lng: number } | { address: string }) {
    setLoading(true);
    setMessage("");
    try {
      const next = await searchBoardGameCafes(location);
      setResult(next);
      setSelectedId(null);
      if (!next.cafes.length) setMessage("No board-game cafes found within 10 km. Try another address.");
    } catch (error) {
      setResult(null);
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function locateMe() {
    // Consent and browser permission are requested only when the user clicks.
    if (!navigator.geolocation) {
      setMessage("This browser cannot provide your location. Please enter an address instead.");
      return;
    }
    setLoading(true);
    setMessage("Requesting location permission...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void runSearch({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setLoading(false);
        setMessage("Location permission was denied or unavailable. Please enter an address or landmark manually.");
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
    );
  }

  const selected = result?.cafes.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader title="Board-game cafes" subtitle="Find places to play near you using Kakao Maps." />
      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold">Where should we look?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Your device location is used only for this search, never saved to your account.
              You can always search manually instead.
            </p>
          </div>
          <Button type="button" onClick={locateMe} loading={loading}>
            Use my current location
          </Button>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => {
            e.preventDefault();
            if (address.trim().length >= 2) void runSearch({ address: address.trim() });
            else setMessage("Please enter an address or a landmark (at least 2 characters).");
          }}>
            <div className="min-w-0 flex-1">
              <TextField label="Or enter an address / landmark" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. KAIST, Daejeon or 대전 유성구 대학로 291" />
            </div>
            <Button type="submit" variant="secondary" loading={loading}>Search cafes</Button>
          </form>
          {message && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
        </div>
      </Card>

      {result && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Map</h2>
            <KakaoCafeMap result={result} selectedCafe={selected} />
            <p className="mt-3 text-xs text-slate-500">Search center: {result.origin.label}. Distances are straight-line estimates.</p>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Nearby cafes</h2>
              <span className="text-xs text-slate-500">{result.cafes.length} results · closest first</span>
            </div>
            <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
              {result.cafes.map((cafe: Cafe) => (
                <article key={cafe.id} className={`rounded-lg border p-3 ${selectedId === cafe.id ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                  <button type="button" className="w-full text-left font-semibold text-brand-700 hover:underline"
                    onClick={() => setSelectedId(cafe.id)} aria-label={`Center map on ${cafe.name}`}>
                    {cafe.name}
                  </button>
                  <p className="mt-1 text-sm text-slate-600">{cafe.address || "Address unavailable"}</p>
                  <p className="mt-1 text-xs text-slate-500">{distanceLabel(cafe.distanceMeters)} away · {cafe.phone || "Phone not listed"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <a href={cafe.placeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">Cafe details</a>
                    <a href={cafe.directionsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">Directions on Kakao Maps</a>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
