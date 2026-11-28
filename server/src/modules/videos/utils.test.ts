import { describe, expect, it } from "vitest";
import { durationLabel, gameVideoKey, normalizeVideo, orderRuleVideos } from "./utils";

describe("Rule video metadata (FR-130–134)", () => {
  it("accepts only valid video IDs, reconstructs safe YouTube links", () => {
    const result = normalizeVideo({ id: "dQw4w9WgXcQ", snippet: { title: "한글 규칙", channelTitle: "Demo" }, contentDetails: { duration: "PT12M34S" } });
    expect(result).toMatchObject({ language: "ko", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration: "PT12M34S" });
    expect(result?.thumbnail).toContain("i.ytimg.com/vi/dQw4w9WgXcQ/");
    expect(normalizeVideo({ id: "https://evil.test/foo", snippet: { title: "Hi" } })).toBeNull();
    expect(normalizeVideo({ id: "aaaaaaaaaaa", snippet: { title: "" } })).toBeNull();
  });
  it("uses language metadata instead of assuming an English title implies English speech", () => {
    expect(normalizeVideo({ id: "abcdefghijk", snippet: { title: "Catan", defaultAudioLanguage: "ko-KR" } })?.language).toBe("ko-kr");
    expect(normalizeVideo({ id: "abcdefghijk", snippet: { title: "Catan" } })?.language).toBe("unknown");
  });
  it("formats ISO 8601 durations", () => {
    expect(durationLabel("PT9M5S")).toBe("9:05");
    expect(durationLabel("PT1H2M3S")).toBe("1:02:03");
    expect(durationLabel(null)).toBeNull();
  });
  it("pins first, then approved, then Korean videos", () => {
    const rows = [
      { title: "English", language: "en", pinned: false, moderationStatus: "AUTO" },
      { title: "한국어", language: "ko", pinned: false, moderationStatus: "AUTO" },
      { title: "Pinned", language: "en", pinned: true, moderationStatus: "APPROVED" },
    ];
    expect(orderRuleVideos(rows).map(r => r.title)).toEqual(["Pinned", "한국어", "English"]);
  });
  it("partitions custom names from catalog game UUIDs", () => {
    expect(gameVideoKey(null, " Catan ")).toBe("custom:catan");
    expect(gameVideoKey("123", "Catan")).toBe("game:123");
  });
});
