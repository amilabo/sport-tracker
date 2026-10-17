import type { IsoDateTime, LocalDate } from "./types";

export function nowIso(): IsoDateTime {
  return new Date().toISOString();
}

/** Local calendar date of a moment, "YYYY-MM-DD". */
export function toLocalDate(date: Date = new Date()): LocalDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "HH:MM" (24-hour); null if not a valid time. */
export function parseTime24(value: string): { h: number; m: number } | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? { h, m: min } : null;
}

/** A workout date: "YYYY-MM-DD", not in the future. */
export function isWorkoutDate(date: string, today: LocalDate = toLocalDate()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
}

/** Start and end of a workout from its local date and "HH:MM" times; an end before the start crossed midnight. */
export function workoutMoments(date: string, start: string, end: string): { start: Date | null; end: Date | null } {
  const at = (hhmm: string) => {
    const t = parseTime24(hhmm);
    const d = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!t || !d) return null;
    return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), t.h, t.m, 0, 0);
  };
  const s = at(start);
  let e = at(end);
  if (s && e && e < s) e = new Date(e.getTime() + 24 * 3600 * 1000);
  return { start: s, end: e };
}
