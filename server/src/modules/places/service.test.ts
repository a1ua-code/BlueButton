import { describe, expect, it } from "vitest";
import { normalizeCafes } from "./service";

describe("Kakao cafe place normalization (FR-124–126)", () => {
  const origin = { lat: 36.35, lng: 127.36 };
  it("sorts by calculated distance, not provider order, and maps contact details", () => {
    const cafes = normalizeCafes([
      { id: "101", place_name: "Far Board Cafe", x: "127.40", y: "36.38", phone: "042-000-001", address_name: "Lot address" },
      { id: "102", place_name: "Near Board Cafe", x: "127.361", y: "36.351", road_address_name: "Road address" },
    ], origin);
    expect(cafes.map((p) => p.id)).toEqual(["102", "101"]);
    expect(cafes[0]?.address).toBe("Road address");
    expect(cafes[1]?.phone).toBe("042-000-001");
    expect(cafes[0]?.directionsUrl).toMatch(/^https:\/\/map\.kakao\.com\/link\/to\//);
  });
  it("discards malformed place coordinates and names", () => {
    const cafes = normalizeCafes([
      { id: "bad", place_name: "Bad", x: "not-a-number", y: "36.35" },
      { id: "no-name", x: "127.36", y: "36.35" },
    ], origin);
    expect(cafes).toEqual([]);
  });
  it("does not propagate untrusted provider URLs", () => {
    const cafes = normalizeCafes([{
      id: "13", place_name: "Game", x: "127.36", y: "36.35",
      // External Kakao data is normalized into approved URLs.
    }], origin);
    expect(cafes[0]?.placeUrl).toBe("https://place.map.kakao.com/13");
    expect(cafes[0]?.distanceMeters).toBe(0);
  });
});
