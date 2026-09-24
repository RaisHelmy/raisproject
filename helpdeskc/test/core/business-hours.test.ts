import { describe, expect, test } from "bun:test";
import { addBusinessMinutes, type BusinessHoursWeek } from "../../src/core/sla/business-hours";

const STANDARD_HOURS: BusinessHoursWeek = {
  mon: [{ start: "09:00", end: "18:00" }],
  tue: [{ start: "09:00", end: "18:00" }],
  wed: [{ start: "09:00", end: "18:00" }],
  thu: [{ start: "09:00", end: "18:00" }],
  fri: [{ start: "09:00", end: "18:00" }],
};

describe("addBusinessMinutes", () => {
  test("stays within the same business day", () => {
    // Mon 2026-01-05 10:00 KL time + 60 min -> 11:00 KL time (UTC+8, no DST)
    const result = addBusinessMinutes("2026-01-05T02:00:00.000Z", 60, "Asia/Kuala_Lumpur", STANDARD_HOURS, []);
    expect(result).toBe("2026-01-05T03:00:00.000Z");
  });

  test("rolls over to the next business day, skipping the weekend", () => {
    // Fri 2026-01-02 17:00 KL + 120 min -> should land Mon 2026-01-05 10:00 KL
    const result = addBusinessMinutes("2026-01-02T09:00:00.000Z", 120, "Asia/Kuala_Lumpur", STANDARD_HOURS, []);
    expect(result).toBe("2026-01-05T02:00:00.000Z");
  });

  test("skips a holiday", () => {
    // Mon 2026-01-05 17:00 KL + 120 min, with Tue 2026-01-06 as a holiday -> Wed 2026-01-07 10:00 KL
    const result = addBusinessMinutes("2026-01-05T09:00:00.000Z", 120, "Asia/Kuala_Lumpur", STANDARD_HOURS, ["2026-01-06"]);
    expect(result).toBe("2026-01-07T02:00:00.000Z");
  });

  test("before business hours starts counting from the window open", () => {
    // Mon 2026-01-05 06:00 KL (before 09:00 open) + 30 min -> 09:30 KL
    const result = addBusinessMinutes("2026-01-04T22:00:00.000Z", 30, "Asia/Kuala_Lumpur", STANDARD_HOURS, []);
    expect(result).toBe("2026-01-05T01:30:00.000Z");
  });

  test("handles a US DST spring-forward transition correctly", () => {
    // America/New_York: DST starts 2026-03-08 02:00 -> 03:00 (EST -> EDT).
    // Fri 2026-03-06 17:30 EST (30 min left in the window) + 60 business
    // min: 30 min finishes Friday, the remaining 30 min lands Monday
    // 2026-03-09 09:30 — which by then is EDT (UTC-4), not EST (UTC-5).
    const businessHours: BusinessHoursWeek = {
      mon: [{ start: "09:00", end: "18:00" }],
      fri: [{ start: "09:00", end: "18:00" }],
    };
    // 2026-03-06T22:30:00Z = Fri 17:30 EST (UTC-5, before the DST switch)
    const result = addBusinessMinutes("2026-03-06T22:30:00.000Z", 60, "America/New_York", businessHours, []);
    // 2026-03-09 09:30 EDT = 13:30 UTC (UTC-4 after spring-forward)
    expect(result).toBe("2026-03-09T13:30:00.000Z");
  });

  test("zero minutes returns the input unchanged", () => {
    const iso = "2026-01-05T02:00:00.000Z";
    expect(addBusinessMinutes(iso, 0, "Asia/Kuala_Lumpur", STANDARD_HOURS, [])).toBe(iso);
  });
});
