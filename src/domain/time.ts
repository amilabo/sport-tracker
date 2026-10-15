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
