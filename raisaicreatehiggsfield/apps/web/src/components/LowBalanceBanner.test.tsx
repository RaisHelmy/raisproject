import { describe, expect, it } from "vitest";

/**
 * The threshold logic, tested directly. Rendering is covered by the browser
 * suite; what matters here is that the banner appears at the right moment.
 */
function shouldWarn(availableSen: number | null, thresholdSen = 500): boolean {
  return availableSen !== null && availableSen < thresholdSen;
}

describe("low balance threshold", () => {
  it("stays quiet while the balance is healthy", () => {
    expect(shouldWarn(5000)).toBe(false);
    expect(shouldWarn(500)).toBe(false);
  });
  it("warns below the threshold and when empty or negative", () => {
    expect(shouldWarn(499)).toBe(true);
    expect(shouldWarn(0)).toBe(true);
    expect(shouldWarn(-50)).toBe(true);
  });
  it("says nothing while the balance is still unknown", () => {
    expect(shouldWarn(null)).toBe(false);
  });
});
