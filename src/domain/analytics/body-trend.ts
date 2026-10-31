import type { ExerciseSession } from "../chart-series";
import type { LocalDate, Workout } from "../types";
import { bestE1rm } from "./e1rm";
import type { AnalyticsItem } from "./month-summary";
import { STRENGTH_TOP, TREND_MIN_DAYS, TREND_MIN_POINTS, TREND_TAU_DAYS, TREND_WINDOW_WEEKS } from "./thresholds";

// «Тело» (stage 43, mockup А4): a smoothed weight trend and «Тренировки и тело» for the period on screen.

const DAY = 86_400_000;
const dayMs = (d: LocalDate) => new Date(`${d}T12:00:00`).getTime();

/**
 * Exponential moving average with uneven gaps: α = 1 − e^(−Δdays/10). A day's water and food swings move it a little,
 * a steady change moves it all the way. Points oldest first.
 */
export function weightTrend(points: { date: LocalDate; value: number }[]): { date: LocalDate; value: number }[] {
  const out: { date: LocalDate; value: number }[] = [];
  for (const p of points) {
    const prev = out.at(-1);
    if (!prev) {
      out.push({ date: p.date, value: p.value });
      continue;
    }
    const alpha = 1 - Math.exp(-(dayMs(p.date) - dayMs(prev.date)) / DAY / TREND_TAU_DAYS);
    out.push({ date: p.date, value: prev.value + alpha * (p.value - prev.value) });
  }
  return out;
}

/**
 * «↓ 0,2 кг в неделю · тренд за 6 недель»: the trend's change per week over the last 6 weeks (or since the first entry,
 * if that is closer). null — fewer than 3 entries or under 14 days.
 */
export function trendRate(trend: { date: LocalDate; value: number }[]): { perWeek: number; weeks: number } | null {
  if (trend.length < TREND_MIN_POINTS) return null;
  const last = trend.at(-1)!;
  const from = dayMs(last.date) - TREND_WINDOW_WEEKS * 7 * DAY;
  const start = trend.find((p) => dayMs(p.date) >= from) ?? trend[0];
  const days = (dayMs(last.date) - dayMs(start.date)) / DAY;
  if (days < TREND_MIN_DAYS) return null;
  return { perWeek: ((last.value - start.value) / days) * 7, weeks: Math.round(days / 7) };
}

export interface TrainingInPeriod {
  workouts: number;
  /** Workouts per week over the period. */
  perWeek: number;
  sets: number;
  /** ≈ максимум of the exercises done most often: first → last workout of the period. */
  strength: { name: string; from: number; to: number }[];
}

/** «Тренировки и тело» (А4) between two dates of the period, both days included. null — no workouts in it. */
export function trainingInPeriod(workouts: Workout[], items: AnalyticsItem[], from: LocalDate, to: LocalDate): TrainingInPeriod | null {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime() + DAY;
  const inside = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };
  const ws = workouts.filter((w) => inside(w.started_at));
  if (!ws.length) return null;
  const its = items.filter((it) => inside(it.startedAt) && !it.we.skipped);
  const sets = its.reduce((n, it) => n + it.sets.filter((s) => s.done_at).length, 0);
  const weeks = Math.max(1, (end - start) / DAY / 7);

  const byExercise = new Map<string, { name: string; sessions: ExerciseSession[] }>();
  for (const it of its) {
    if (it.exercise.log_type !== "weight_reps") continue;
    const e = byExercise.get(it.exercise.id) ?? { name: it.exercise.name, sessions: [] };
    e.sessions.push({ workoutId: it.workoutId, startedAt: it.startedAt, sets: it.sets });
    byExercise.set(it.exercise.id, e);
  }
  const strength = [...byExercise.values()]
    .map((e) => {
      const points = e.sessions
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .map((s) => bestE1rm(s.sets)?.value)
        .filter((v): v is number => v !== undefined);
      return { name: e.name, count: e.sessions.length, points };
    })
    .filter((e) => e.points.length >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, STRENGTH_TOP)
    .map((e) => ({ name: e.name, from: e.points[0], to: e.points.at(-1)! }));

  return { workouts: ws.length, perWeek: ws.length / weeks, sets, strength };
}
