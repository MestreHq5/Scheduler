/**
 * Timezone helpers. We rely entirely on the IANA tz database via Intl — no
 * external API needed, and summer/winter time shifts automatically as long
 * as we always convert through a named zone (e.g. "Europe/Lisbon") rather
 * than a fixed offset.
 */

export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowClockInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Splits a UTC instant into the local calendar date + HH:mm for a given tz. */
export function instantToLocalParts(iso: string, timezone: string) {
  const date = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return { date: dateFmt, time: timeFmt };
}

/**
 * Calendar-date arithmetic below is done entirely in UTC millis, never via a
 * local-time `Date` constructed from a bare date string. Mixing the two (as
 * an earlier version did — parsing local, then serializing with
 * `.toISOString()`, which is always UTC) silently shifts the result by a day
 * whenever the local offset is positive. These dates are plain wall-clock
 * calendar dates with no timezone attached, so UTC here is just a neutral
 * arithmetic base, not a claim about the user's zone.
 */
function toDateStr(utcMillis: number): string {
  return new Date(utcMillis).toISOString().slice(0, 10);
}

function toUtcMillis(dateStr: string): number {
  const parts = dateStr.split("-").map(Number);
  return Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!);
}

/** Monday-start week (ISO) containing the given YYYY-MM-DD date string. */
export function startOfWeek(dateStr: string): string {
  const utc = toUtcMillis(dateStr);
  const day = new Date(utc).getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return toDateStr(utc + diff * 86_400_000);
}

export function addDays(dateStr: string, days: number): string {
  return toDateStr(toUtcMillis(dateStr) + days * 86_400_000);
}

export function weekDates(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}

export function startOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}-${m}-01`;
}

export function addMonths(dateStr: string, months: number): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return toDateStr(Date.UTC(ny, nm, d));
}

export function endOfMonth(dateStr: string): string {
  return addDays(addMonths(startOfMonth(dateStr), 1), -1);
}

/** Number of whole days between two YYYY-MM-DD dates (end - start). */
export function daysBetween(startStr: string, endStr: string): number {
  return Math.round((toUtcMillis(endStr) - toUtcMillis(startStr)) / 86_400_000);
}

/**
 * Formats a YYYY-MM-DD date string as day/month (year optional), always
 * zero-padded — the one date format used everywhere in the UI. Never render
 * a raw YYYY-MM-DD or a `.slice(5)` MM-DD fragment to the user directly.
 */
export function formatDateDMY(dateStr: string, withYear = false): string {
  const [y, m, d] = dateStr.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export type RangePreset = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last3m" | "last6m" | "last12m";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  thisWeek: "This week",
  lastWeek: "Last week",
  thisMonth: "This month",
  lastMonth: "Last month",
  last3m: "Last 3 months",
  last6m: "Last 6 months",
  last12m: "Last year",
};

/** Resolves a range preset relative to `today` (YYYY-MM-DD, already in the user's timezone). */
export function resolveRangePreset(preset: RangePreset, today: string): { start: string; end: string } {
  switch (preset) {
    case "thisWeek":
      return { start: startOfWeek(today), end: today };
    case "lastWeek": {
      const monday = addDays(startOfWeek(today), -7);
      return { start: monday, end: addDays(monday, 6) };
    }
    case "thisMonth":
      return { start: startOfMonth(today), end: today };
    case "lastMonth": {
      const monday = startOfMonth(addMonths(today, -1));
      return { start: monday, end: endOfMonth(monday) };
    }
    case "last3m":
      return { start: addMonths(today, -3), end: today };
    case "last6m":
      return { start: addMonths(today, -6), end: today };
    case "last12m":
      return { start: addMonths(today, -12), end: today };
  }
}
