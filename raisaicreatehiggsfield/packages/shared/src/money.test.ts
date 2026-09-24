import { describe, expect, it } from "vitest";
import { formatMYR, roundUpSen, sen, usdToSen } from "./money";
import { isPortCompatible } from "./ports";
import { AppError } from "./errors";

describe("money", () => {
  it("formats sen as MYR", () => {
    expect(formatMYR(38)).toBe("RM0.38");
    expect(formatMYR(4962)).toBe("RM49.62");
    expect(formatMYR(-5)).toBe("-RM0.05");
    expect(formatMYR(123456)).toBe("RM1,234.56");
  });
  it("converts MYR to sen", () => {
    expect(sen(0.38)).toBe(38);
    expect(sen(50)).toBe(5000);
  });
  it("converts micro-USD to sen rounding up", () => {
    expect(usdToSen(1_000_000, 4.7)).toBe(470);
    expect(usdToSen(52_800, 4.7)).toBe(25); // 0.0528 USD -> 24.8 sen -> 25
  });
  it("rounds up to step", () => {
    expect(roundUpSen(23, 5)).toBe(25);
    expect(roundUpSen(25, 5)).toBe(25);
    expect(roundUpSen(23, 0)).toBe(23);
  });
});

describe("ports", () => {
  it("allows image -> image and image -> image[]", () => {
    expect(isPortCompatible("image", "image")).toBe(true);
    expect(isPortCompatible("image", "image[]")).toBe(true);
  });
  it("rejects image -> number", () => {
    expect(isPortCompatible("image", "number")).toBe(false);
  });
  it("anything -> any", () => {
    expect(isPortCompatible("video", "any")).toBe(true);
  });
});

describe("AppError", () => {
  it("serializes to the error envelope", () => {
    const e = new AppError("insufficient_balance", "Not enough balance.", { action: "Add balance." });
    expect(e.status).toBe(402);
    expect(e.toJSON()).toEqual({ error: { code: "insufficient_balance", message: "Not enough balance.", action: "Add balance." } });
  });
});
