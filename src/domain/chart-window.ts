import { minusMonths } from "./body-compare";
import type { LocalDate } from "./types";

// The window of a measurement's chart (stage 31, mockup 31): the big chart shows only points a..b, scaled to them;
// the strip under it shows the whole history with the window framed. Points are oldest first.

export interface ChartWindow {
  /** Index of the first point shown. */
  a: number;
  /** Index of the last point shown; a ≤ b. */
  b: number;
}

/** The last `months` up to the latest point (by calendar months, as «3 мес» on «Тело»); null — the whole history. */
export function presetWindow(dates: LocalDate[], months: number | null): ChartWindow {
  const b = Math.max(dates.length - 1, 0);
  if (months === null || !dates.length) return { a: 0, b };
  const edge = minusMonths(dates[b], months);
  const a = dates.findIndex((d) => d >= edge);
  return { a: a < 0 ? b : a, b };
}

/** ‹ › on «С» or «По»: one point earlier or later; null when the window would be empty or leave the history. */
export function stepEdge(win: ChartWindow, edge: "a" | "b", dir: -1 | 1, count: number): ChartWindow | null {
  if (edge === "a") {
    const a = win.a + dir;
    return a >= 0 && a < win.b ? { ...win, a } : null;
  }
  const b = win.b + dir;
  return b > win.a && b < count ? { ...win, b } : null;
}

/** Dragging an edge on the strip to point `index`: it stops one point before the other edge. */
export function moveEdge(win: ChartWindow, edge: "a" | "b", index: number, count: number): ChartWindow {
  if (count < 2) return win;
  if (edge === "a") return { ...win, a: Math.max(0, Math.min(index, win.b - 1)) };
  return { ...win, b: Math.min(count - 1, Math.max(index, win.a + 1)) };
}

/** A window given as dates (kept across new measurements) → indices; dates that are gone give the whole history. */
export function windowOf(dates: LocalDate[], from: LocalDate | null, to: LocalDate | null): ChartWindow {
  const a = from === null ? -1 : dates.indexOf(from);
  const b = to === null ? -1 : dates.indexOf(to);
  return a >= 0 && b >= a ? { a, b } : presetWindow(dates, null);
}
