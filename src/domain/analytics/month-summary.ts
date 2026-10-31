import { chartSeries, type ExerciseSession } from "../chart-series";
import { dayKey, weekStart } from "../rhythm";
import { setVolume } from "../summary";
import type { Exercise, Id, IsoDateTime, Workout, WorkoutExercise, WorkoutSet } from "../types";
import { bestE1rm } from "./e1rm";
import { workoutRecords } from "./records";
import { stall } from "./stall";
import { FEEL_MIN, MONTH_GROWTH_MAX, MOOD_MIN } from "./thresholds";

// «Итоги месяца» (stage 45, mockup А6): counted when the screen opens from the workouts on the phone, nothing stored.

/** One exercise of a completed workout, with all its sets (done or not). */
export interface AnalyticsItem {
  workoutId: Id;
  startedAt: IsoDateTime;
  we: Pick<WorkoutExercise, "skipped" | "replaced_exercise_id">;
  exercise: Pick<Exercise, "id" | "name" | "log_type" | "muscle_group" | "is_builtin" | "secondary_groups">;
  sets: WorkoutSet[];
}

export interface MonthSummary {
  workouts: number;
  /** «4 из 4 недель в ритме»: finished weeks touching the month with the goal reached; null — no goal. */
  rhythm: { full: number; total: number } | null;
  records: number;
  recordExercises: number;
  sets: number;
  prevSets: number;
  volume: number;
  prevVolume: number;
  /** «Рост за месяц · ≈ максимум»: the month's best minus the best before it, kg. */
  growth: { name: string; delta: number }[];
  /** «на одном уровне» at the month's end, among the month's exercises. */
  stalled: string[];
  /** Averages over the month's workouts with both marks; null — fewer than 5. */
  mood: { before: number; after: number; count: number } | null;
  /** Share of done sets (%) by wellbeing before, all time; null — fewer than 8 workouts in a group. */
  feel: { high: number; low: number; highCount: number; lowCount: number } | null;
}

function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime()];
}

const t = (iso: IsoDateTime) => new Date(iso).getTime();

/** Sessions of each exercise actually done, oldest first. */
function sessionsByExercise(items: AnalyticsItem[]): Map<Id, (ExerciseSession & { name: string; logType: Exercise["log_type"] })[]> {
  const out = new Map<Id, (ExerciseSession & { name: string; logType: Exercise["log_type"] })[]>();
  for (const it of items) {
    if (it.we.skipped) continue;
    const list = out.get(it.exercise.id) ?? [];
    list.push({ workoutId: it.workoutId, startedAt: it.startedAt, sets: it.sets, name: it.exercise.name, logType: it.exercise.log_type });
    out.set(it.exercise.id, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return out;
}

/** Finished weeks (Mon–Sun) with a day in the month, and how many reached the goal. */
function monthRhythm(year: number, month: number, workouts: Workout[], goal: number, now: Date): { full: number; total: number } {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    const k = dayKey(weekStart(new Date(w.started_at)));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let full = 0, total = 0;
  const end = new Date(year, month + 1, 0);
  for (let d = weekStart(new Date(year, month, 1)); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    const weekEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    if (weekEnd > now) continue;
    total++;
    if ((counts.get(dayKey(d)) ?? 0) >= goal) full++;
  }
  return { full, total };
}

export function monthSummary(year: number, month: number, workouts: Workout[], items: AnalyticsItem[], goal: number | null, now: Date): MonthSummary {
  const [from, to] = monthRange(year, month);
  const [prevFrom] = monthRange(year, month - 1);
  const inMonth = (iso: IsoDateTime) => t(iso) >= from && t(iso) < to;
  const inPrev = (iso: IsoDateTime) => t(iso) >= prevFrom && t(iso) < from;
  const monthWorkouts = workouts.filter((w) => inMonth(w.started_at)).sort((a, b) => a.started_at.localeCompare(b.started_at));

  const countSets = (pred: (iso: IsoDateTime) => boolean) => {
    let sets = 0, volume = 0;
    for (const it of items) {
      if (!pred(it.startedAt)) continue;
      for (const s of it.sets) {
        if (!s.done_at) continue;
        sets++;
        volume += setVolume(it.exercise.log_type, s);
      }
    }
    return { sets, volume: Math.round(volume) };
  };
  const cur = countSets(inMonth);
  const prev = countSets(inPrev);

  // Records: each workout of the month against everything before it.
  const sessions = sessionsByExercise(items);
  let records = 0;
  const recordExercises = new Set<Id>();
  for (const w of monthWorkouts) {
    const own = items.filter((it) => it.workoutId === w.id && !it.we.skipped);
    const history = new Map<Id, ExerciseSession[]>();
    for (const it of own) history.set(it.exercise.id, (sessions.get(it.exercise.id) ?? []).filter((s) => s.startedAt < w.started_at));
    for (const r of workoutRecords(own.map((it) => ({ exerciseId: it.exercise.id, name: it.exercise.name, logType: it.exercise.log_type, sets: it.sets })), history)) {
      records++;
      recordExercises.add(r.exerciseId);
    }
  }

  // ≈ максимум growth and stalls of the exercises done this month.
  const growth: { name: string; delta: number }[] = [];
  const stalled: string[] = [];
  for (const list of sessions.values()) {
    const month = list.filter((s) => inMonth(s.startedAt));
    if (!month.length || list[0].logType !== "weight_reps") continue;
    const best = (ss: ExerciseSession[]) => Math.max(-Infinity, ...ss.map((s) => bestE1rm(s.sets)?.value ?? -Infinity));
    const now_ = best(month);
    const before = best(list.filter((s) => t(s.startedAt) < from));
    if (Number.isFinite(now_) && Number.isFinite(before) && now_ > before) growth.push({ name: list[0].name, delta: now_ - before });
    else if (stall(chartSeries("weight_reps", list.filter((s) => t(s.startedAt) < to), "e1rm"))) stalled.push(list[0].name);
  }
  growth.sort((a, b) => b.delta - a.delta);

  const marked = monthWorkouts.filter((w) => w.mood_before !== null && w.mood_after !== null);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mood =
    marked.length >= MOOD_MIN ? { before: avg(marked.map((w) => w.mood_before!)), after: avg(marked.map((w) => w.mood_after!)), count: marked.length } : null;

  // Wellbeing before and the share of sets done, all time.
  const group = (pick: (n: number) => boolean) => {
    const ws = workouts.filter((w) => w.wellbeing_before !== null && pick(w.wellbeing_before));
    const ids = new Set(ws.map((w) => w.id));
    let done = 0, total = 0;
    for (const it of items) {
      if (!ids.has(it.workoutId)) continue;
      total += it.sets.length;
      done += it.sets.filter((s) => s.done_at).length;
    }
    return { count: ws.length, percent: total ? Math.round((done / total) * 100) : 0 };
  };
  const high = group((n) => n >= 4);
  const low = group((n) => n <= 3);
  const feel = high.count >= FEEL_MIN && low.count >= FEEL_MIN ? { high: high.percent, low: low.percent, highCount: high.count, lowCount: low.count } : null;

  return {
    workouts: monthWorkouts.length,
    rhythm: goal ? monthRhythm(year, month, workouts, goal, now) : null,
    records,
    recordExercises: recordExercises.size,
    sets: cur.sets,
    prevSets: prev.sets,
    volume: cur.volume,
    prevVolume: prev.volume,
    growth: growth.slice(0, MONTH_GROWTH_MAX),
    stalled,
    mood,
    feel,
  };
}
