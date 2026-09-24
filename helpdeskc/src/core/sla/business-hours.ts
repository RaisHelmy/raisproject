// Business-hours SLA math. Pure, timezone-aware, DST-correct — this is
// where the bugs live (CLAUDE.md §14), so every date computation here goes
// through the tenant's IANA timezone via Intl, never UTC wall-clock.

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface HoursWindow {
  /** "HH:mm" in the tenant's local time */
  start: string;
  end: string;
}

export type BusinessHoursWeek = Partial<Record<Weekday, HoursWindow[]>>;

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: Weekday;
  hour: number;
  minute: number;
}

const weekdayFmtCache = new Map<string, Intl.DateTimeFormat>();
function getFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = weekdayFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    weekdayFmtCache.set(tz, fmt);
  }
  return fmt;
}

function toLocalParts(instantMs: number, tz: string): LocalParts {
  const parts = getFormatter(tz).formatToParts(new Date(instantMs));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, Weekday> = {
    Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat",
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday!]!,
    hour: map.hour === "24" ? 0 : Number(map.hour),
    minute: Number(map.minute),
  };
}

function offsetMsAt(instantMs: number, tz: string): number {
  const p = toLocalParts(instantMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return asUtc - instantMs;
}

/** Convert a local wall-clock date+time in `tz` to a UTC instant (ms), resolving the correct DST offset for that specific date. */
export function zonedTimeToUtcMs(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset1 = offsetMsAt(guess, tz);
  let utc = guess - offset1;
  const offset2 = offsetMsAt(utc, tz);
  if (offset2 !== offset1) utc = guess - offset2;
  return utc;
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isHoliday(year: number, month: number, day: number, holidays: readonly string[]): boolean {
  return holidays.includes(ymd(year, month, day));
}

function addDays(year: number, month: number, day: number, n: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + n);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

/**
 * Adds `minutes` of business time to `fromIso`, honouring per-weekday
 * windows and holidays, and returns the resulting instant as ISO-8601 UTC.
 * Used to compute SLA due dates at ticket creation (targets are
 * snapshotted, per CLAUDE.md §10 — this is not re-run on old tickets).
 */
export function addBusinessMinutes(
  fromIso: string,
  minutes: number,
  tz: string,
  businessHours: BusinessHoursWeek,
  holidays: readonly string[] = [],
): string {
  if (minutes <= 0) return fromIso;

  let remaining = minutes;
  let cursor = toLocalParts(Date.parse(fromIso), tz);
  let { year, month, day } = cursor;
  let dayOffset = 0;

  // Cap the search so a tenant with no business hours configured at all
  // can't spin this forever.
  const MAX_DAYS = 3650;

  while (dayOffset < MAX_DAYS) {
    const weekday = dayOffset === 0 ? cursor.weekday : toLocalParts(zonedTimeToUtcMs(year, month, day, 12, 0, tz), tz).weekday;
    const windows = businessHours[weekday] ?? [];
    const holiday = isHoliday(year, month, day, holidays);

    if (!holiday) {
      for (const w of windows) {
        const windowStartMin = timeToMinutes(w.start);
        const windowEndMin = timeToMinutes(w.end);
        const dayStartMin = dayOffset === 0 ? Math.max(windowStartMin, cursor.hour * 60 + cursor.minute) : windowStartMin;
        if (dayStartMin >= windowEndMin) continue;

        const availableMin = windowEndMin - dayStartMin;
        if (remaining <= availableMin) {
          const resultMin = dayStartMin + remaining;
          const h = Math.floor(resultMin / 60);
          const m = resultMin % 60;
          const utcMs = zonedTimeToUtcMs(year, month, day, h, m, tz);
          return new Date(utcMs).toISOString();
        }
        remaining -= availableMin;
      }
    }

    dayOffset += 1;
    const next = addDays(cursor.year, cursor.month, cursor.day, dayOffset);
    year = next.year;
    month = next.month;
    day = next.day;
  }

  throw new Error("addBusinessMinutes: no business hours found within search window");
}
