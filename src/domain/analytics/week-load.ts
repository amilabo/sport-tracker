import { muscleGroupsOf } from "@/content/exercise-muscles";
import { setVolume } from "../summary";
import type { MuscleGroup } from "../types";
import type { AnalyticsItem } from "./month-summary";
import { LAG_RATIO, LAG_WEEKS, SECONDARY_SHARE, SPIKE_BASE_WEEKS, SPIKE_RATIO } from "./thresholds";

// «Нагрузка недели» (stage 42б, mockup А3): sets per muscle group in a week (Mon–Sun, local time). The main group of an
// exercise gets 1 per done set, each secondary one 0,5. Cardio and whole-body exercises count in the week's sets but
// have no bar. Nothing stored: counted from the workouts on the phone when «Ритм» opens.

/** Bars in this order before sorting; cardio and whole body are not here. */
export const LOAD_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "glutes", "shoulders", "arms", "abs"];

/** «Спина отстаёт» pairs. */
export const LAG_PAIRS: [MuscleGroup, MuscleGroup][] = [
  ["chest", "back"],
  ["legs", "glutes"],
];

const DAY = 86_400_000;

/** Local Monday 00:00 of the week `weeksBack` before the one starting at `weekStart`. */
function shift(weekStart: Date, weeksBack: number): Date {
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7 * weeksBack);
}

interface WeekTotals {
  workouts: number;
  sets: number;
  volume: number;
  groups: Map<MuscleGroup, number>;
}

function totals(items: AnalyticsItem[], start: Date): WeekTotals {
  const from = start.getTime();
  const to = shift(start, -1).getTime();
  const workouts = new Set<string>();
  const groups = new Map<MuscleGroup, number>();
  let sets = 0, volume = 0;
  for (const it of items) {
    const t = new Date(it.startedAt).getTime();
    if (t < from || t >= to || it.we.skipped) continue;
    workouts.add(it.workoutId);
    const done = it.sets.filter((s) => s.done_at);
    if (!done.length) continue;
    sets += done.length;
    volume += done.reduce((v, s) => v + setVolume(it.exercise.log_type, s), 0);
    const { main, secondary } = muscleGroupsOf(it.exercise);
    if (!LOAD_GROUPS.includes(main)) continue;
    groups.set(main, (groups.get(main) ?? 0) + done.length);
    for (const g of secondary) groups.set(g, (groups.get(g) ?? 0) + done.length * SECONDARY_SHARE);
  }
  // Workouts of the week with nothing ticked still count as workouts.
  for (const it of items) {
    const t = new Date(it.startedAt).getTime();
    if (t >= from && t < to) workouts.add(it.workoutId);
  }
  return { workouts: workouts.size, sets, volume: Math.round(volume), groups };
}

export interface WeekLoad {
  workouts: number;
  sets: number;
  volume: number;
  /** Sorted by sets, most first; only groups with sets this week or usually. */
  bars: { group: MuscleGroup; sets: number; usual: number | null }[];
  /** «Спина отстаёт»: the group, its sets, the pair and its sets. */
  lag: { group: MuscleGroup; sets: number; pair: MuscleGroup; pairSets: number } | null;
  /** «Нагрузка резко выросла»: this week's sets against the usual. */
  spike: { sets: number; usual: number; ratio: number } | null;
}

/**
 * The load of the week starting at `weekStart`. «Обычно» — the average of the previous 4 weeks, counted from the week of
 * the first workout (before it there is nothing to average); with no such week there is no mark and no spike.
 */
export function weekLoad(items: AnalyticsItem[], weekStart: Date): WeekLoad {
  const cur = totals(items, weekStart);
  const first = items.reduce((min, it) => Math.min(min, new Date(it.startedAt).getTime()), Infinity);
  const base: WeekTotals[] = [];
  for (let k = 1; k <= SPIKE_BASE_WEEKS; k++) {
    const start = shift(weekStart, k);
    if (start.getTime() + 7 * DAY <= first) break;
    base.push(totals(items, start));
  }
  const avg = (f: (w: WeekTotals) => number) => (base.length ? base.reduce((n, w) => n + f(w), 0) / base.length : null);

  const bars = LOAD_GROUPS.map((group) => ({ group, sets: cur.groups.get(group) ?? 0, usual: avg((w) => w.groups.get(group) ?? 0) }))
    .filter((b) => b.sets > 0 || (b.usual ?? 0) > 0)
    .sort((a, b) => b.sets - a.sets || (b.usual ?? 0) - (a.usual ?? 0));

  // Lagging: under a third of the pair in each of the last 3 weeks, the shown one included.
  let lag: WeekLoad["lag"] = null;
  const recent = [cur, ...Array.from({ length: LAG_WEEKS - 1 }, (_, k) => totals(items, shift(weekStart, k + 1)))];
  for (const [a, b] of LAG_PAIRS) {
    for (const [group, pair] of [[a, b], [b, a]] as const) {
      const lagging = recent.every((w) => {
        const p = w.groups.get(pair) ?? 0;
        return p > 0 && (w.groups.get(group) ?? 0) < p * LAG_RATIO;
      });
      if (lagging && !lag) lag = { group, sets: cur.groups.get(group) ?? 0, pair, pairSets: cur.groups.get(pair) ?? 0 };
    }
  }

  const usualSets = base.length === SPIKE_BASE_WEEKS ? avg((w) => w.sets) : null;
  const spike = usualSets && cur.sets > usualSets * SPIKE_RATIO ? { sets: cur.sets, usual: Math.round(usualSets), ratio: cur.sets / usualSets } : null;

  return { workouts: cur.workouts, sets: cur.sets, volume: cur.volume, bars, lag, spike };
}

/** The week shown first (А3): the current one if it already has a workout, otherwise the previous one. */
export function defaultLoadWeek(items: AnalyticsItem[], currentWeekStart: Date): Date {
  const from = currentWeekStart.getTime();
  const has = items.some((it) => new Date(it.startedAt).getTime() >= from);
  return has ? currentWeekStart : shift(currentWeekStart, 1);
}

export { shift as weeksBefore };
