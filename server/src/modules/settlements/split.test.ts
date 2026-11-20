// Example unit test. Run all tests with `npm test` from the project root.
// Vitest docs: https://vitest.dev/guide/
import { describe, expect, it } from "vitest";
import { splitEvenly } from "./split";

const sum = (shares: { amountKrw: number }[]) => shares.reduce((s, x) => s + x.amountKrw, 0);

describe("splitEvenly", () => {
  it("gives the leftover won to the requester", () => {
    const shares = splitEvenly(10_000, ["a", "b", "c"], "c");
    expect(shares).toEqual([
      { userId: "a", amountKrw: 3333 },
      { userId: "b", amountKrw: 3333 },
      { userId: "c", amountKrw: 3334 },
    ]);
  });

  it("always adds up to the total", () => {
    for (const total of [1, 7, 999, 10_001, 123_457]) {
      expect(sum(splitEvenly(total, ["a", "b", "c", "d"], "b"))).toBe(total);
    }
  });

  it("works when the requester is not one of the payers", () => {
    expect(sum(splitEvenly(1000, ["a", "b", "c"], "z"))).toBe(1000);
  });

  it("rejects bad totals", () => {
    expect(() => splitEvenly(0, ["a"], "a")).toThrow();
    expect(() => splitEvenly(10.5, ["a"], "a")).toThrow();
  });
});
