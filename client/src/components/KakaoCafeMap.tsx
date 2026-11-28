import { useEffect, useRef, useState } from "react";
import type { Cafe, CafeSearch } from "../api/places";

type KakaoLatLng = object;
type KakaoMapInstance = { setBounds(bounds: object): void; setCenter(point: KakaoLatLng): void };
type KakaoMaps = {
  load(callback: () => void): void;
  event: { addListener(target: object, eventName: string, handler: () => void): void };
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => { extend(point: KakaoLatLng): void };
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  Marker: new (options: { map: KakaoMapInstance; position: KakaoLatLng; title: string }) => object;
};

type KakaoWindow = Window & { kakao?: { maps: KakaoMaps } };
let sdkLoad: Promise<KakaoMaps> | null = null;

function loadSdk(key: string): Promise<KakaoMaps> {
  const existing = (window as KakaoWindow).kakao?.maps;
  if (existing) return new Promise((resolve) => existing.load(() => resolve(existing)));
  if (sdkLoad) return sdkLoad;
  sdkLoad = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${encodeURIComponent(key)}`;
    script.onload = () => {
      const maps = (window as KakaoWindow).kakao?.maps;
      if (!maps) { reject(new Error("Kakao SDK did not initialize")); return; }
      maps.load(() => resolve(maps));
    };
    script.onerror = () => reject(new Error("Unable to load Kakao Maps SDK"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    sdkLoad = null;
    throw error;
  });
  return sdkLoad;
}

export function KakaoCafeMap({ result, selectedCafe, onSelectCafe }: {
  result: CafeSearch; selectedCafe?: Cafe; onSelectCafe?: (cafe: Cafe) => void;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState("");
  const key = import.meta.env.VITE_KAKAO_JS_KEY?.trim() ?? "";
  const onSelectCafeRef = useRef(onSelectCafe);
  onSelectCafeRef.current = onSelectCafe;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void loadSdk(key).then((maps) => {
      if (cancelled || !elementRef.current) return;
      setFailure("");
      const center = new maps.LatLng(result.origin.lat, result.origin.lng);
      const map = new maps.Map(elementRef.current, { center, level: 5 });
      const bounds = new maps.LatLngBounds();
      bounds.extend(center);
      new maps.Marker({ map, position: center, title: "Search center" });
      for (const cafe of result.cafes) {
        const point = new maps.LatLng(cafe.lat, cafe.lng);
        bounds.extend(point);
        const marker = new maps.Marker({ map, position: point, title: cafe.name });
        if (onSelectCafeRef.current) {
          maps.event.addListener(marker, "click", () => onSelectCafeRef.current?.(cafe));
        }
      }
      if (selectedCafe) {
        map.setCenter(new maps.LatLng(selectedCafe.lat, selectedCafe.lng));
      } else if (result.cafes.length) {
        map.setBounds(bounds);
      }
    }).catch(() => {
      if (!cancelled) setFailure("Map could not be displayed. Cafe results and directions links are still available.");
    });
    return () => { cancelled = true; };
  }, [key, result, selectedCafe]);

  if (!key) return (
    <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
      Map preview needs a Kakao JavaScript key. The cafe list and directions links remain available.
    </div>
  );
  return (
    <div className="space-y-2">
      <div ref={elementRef} aria-label="Map of nearby board game cafes" role="img" className="h-80 w-full overflow-hidden rounded-lg border border-slate-200" />
      {failure && <p className="text-sm text-amber-700" role="status">{failure}</p>}
    </div>
  );
}
