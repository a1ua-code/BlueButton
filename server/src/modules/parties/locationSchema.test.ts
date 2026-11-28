import { describe, expect, it } from "vitest";
import { createPartySchema } from "./schemas";

const valid = () => ({
  title: "KAIST Game",
  gameName: "Catan",
  capacity: 4,
  startAt: new Date(Date.now() + 86_400_000).toISOString(),
  locationName: "Cafe name",
  availability: "CAFE",
  beginnerFriendly: true,
});

describe("Party mapped meeting location (FR-37/38/127)", () => {
  it("accepts a selected cafe with address and both coordinates", () => {
    const parsed = createPartySchema.parse({
      ...valid(), address: "대전 유성구 대학로 291", lat: 36.35, lng: 127.36,
    });
    expect(parsed.address).toBe("대전 유성구 대학로 291");
    expect(parsed.lat).toBe(36.35);
    expect(parsed.lng).toBe(127.36);
  });

  it("keeps manual entry possible without coordinates", () => {
    const parsed = createPartySchema.parse({ ...valid(), locationName: "N1 lounge", availability: "OWNED" });
    expect(parsed.lat).toBeUndefined();
    expect(parsed.lng).toBeUndefined();
  });

  it("rejects a partially supplied coordinate pair", () => {
    expect(createPartySchema.safeParse({ ...valid(), lat: 36.35 }).success).toBe(false);
    expect(createPartySchema.safeParse({ ...valid(), lng: 127.36 }).success).toBe(false);
  });

  it("rejects invalid latitude or longitude", () => {
    expect(createPartySchema.safeParse({ ...valid(), lat: 95, lng: 127.36 }).success).toBe(false);
    expect(createPartySchema.safeParse({ ...valid(), lat: 36.35, lng: 190 }).success).toBe(false);
  });
});
