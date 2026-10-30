import { bestE1rm } from "./analytics/e1rm";
import { formatNumber, plural } from "./format";
import { formatCardioDuration, formatClock } from "./sets";
import type { IsoDateTime, LogType, WorkoutSet } from "./types";

// Progress chart (PRD §3.9): one point per workout, the Y value depends on the log type.

export interface ExerciseSession {
  workoutId: string;
  startedAt: IsoDateTime;
  sets: WorkoutSet[];
}

export interface ChartPoint {
  workoutId: string;
  date: IsoDateTime;
  value: number;
  /** Shown at the dot: reps of the best weight set ("×12"), otherwise null. */
  label: string | null;
}

export type Period = "1m" | "3m" | "all";

/** What the «вес × раз» chart shows (stage 40, А1): the heaviest set or the estimated one-rep max. */
export type ChartMetric = "best" | "e1rm";

export const PERIOD_LABELS: Record<Period, string> = { "1m": "1 мес", "3m": "3 мес", all: "Всё" };

/**
 * weight_reps — the heaviest done set (label: its reps); bodyweight_plus — the largest added weight, assistance
 * is negative, no weight is 0; reps — most reps in a set; time — the longest set; cardio — total time.
 * A workout without done sets gives no point.
 */
export function pointFor(logType: LogType, session: ExerciseSession): ChartPoint | null {
  const done = session.sets.filter((s) => s.done_at);
  const base = { workoutId: session.workoutId, date: session.startedAt };
  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus": {
      const withWeight = done
        .map((s) => ({ s, w: s.weight ?? (logType === "bodyweight_plus" ? 0 : null) }))
        .filter((x): x is { s: WorkoutSet; w: number } => x.w !== null);
      if (!withWeight.length) return null;
      const max = Math.max(...withWeight.map((x) => x.w));
      const reps = Math.max(...withWeight.filter((x) => x.w === max).map((x) => x.s.reps ?? 0));
      return { ...base, value: max, label: reps ? `×${reps}` : null };
    }
    case "reps": {
      const reps = done.map((s) => s.reps).filter((v): v is number => v !== null);
      return reps.length ? { ...base, value: Math.max(...reps), label: null } : null;
    }
    case "time": {
      const sec = done.map((s) => s.duration_sec).filter((v): v is number => v !== null);
      return sec.length ? { ...base, value: Math.max(...sec), label: null } : null;
    }
    case "cardio": {
      const sec = done.map((s) => s.duration_sec).filter((v): v is number => v !== null);
      return sec.length ? { ...base, value: sec.reduce((a, b) => a + b, 0), label: null } : null;
    }
  }
}

/** ≈ максимум of the workout's best set (rounded to 0,5 kg), label — that set: «22,5×10». */
export function e1rmPointFor(session: ExerciseSession): ChartPoint | null {
  const best = bestE1rm(session.sets);
  if (!best) return null;
  return { workoutId: session.workoutId, date: session.startedAt, value: best.value, label: `${formatNumber(best.set.weight!, 2)}×${best.set.reps}` };
}

/** Points in date order. `e1rm` — «вес × раз» only; a workout without a set of 1…12 reps gives no point. */
export function chartSeries(logType: LogType, sessions: ExerciseSession[], metric: ChartMetric = "best"): ChartPoint[] {
  const point = metric === "e1rm" && logType === "weight_reps" ? e1rmPointFor : (s: ExerciseSession) => pointFor(logType, s);
  return sessions
    .map(point)
    .filter((p): p is ChartPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 1 мес / 3 мес — calendar months back from now. */
export function inPeriod(points: ChartPoint[], period: Period, now: Date = new Date()): ChartPoint[] {
  if (period === "all") return points;
  const from = new Date(now);
  from.setMonth(from.getMonth() - (period === "1m" ? 1 : 3));
  return points.filter((p) => new Date(p.date) >= from);
}

/** A Y value with its unit: "17,5 кг", "−20 кг", "12 раз", "1:30", "15 мин". */
export function formatValue(logType: LogType, value: number): string {
  switch (logType) {
    case "weight_reps":
      return `${formatNumber(value)} кг`;
    case "bodyweight_plus":
      return value > 0 ? `+${formatNumber(value)} кг` : value < 0 ? `−${formatNumber(-value)} кг` : "свой вес";
    case "reps":
      return `${value} ${plural(value, ["раз", "раза", "раз"])}`;
    case "time":
      return formatClock(value);
    case "cardio":
      return formatCardioDuration(value);
  }
}

/** Short axis label without the unit: "17,5", "−20", "12", "1:30", "15". */
export function formatAxis(logType: LogType, value: number): string {
  if (logType === "time") return formatClock(value);
  if (logType === "cardio") return formatNumber(value / 60);
  if (value < 0) return `−${formatNumber(-value)}`;
  return formatNumber(value);
}

/** «+2,5 кг», «−1 раз», «+0:15»; null when there is nothing to compare. */
export function formatDelta(logType: LogType, points: ChartPoint[]): string | null {
  if (points.length < 2) return null;
  const diff = points.at(-1)!.value - points[0].value;
  if (diff === 0) return "без изменений";
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus":
      return `${sign}${formatNumber(abs)} кг`;
    case "reps":
      return `${sign}${abs} ${plural(abs, ["раз", "раза", "раз"])}`;
    case "time":
      return `${sign}${formatClock(abs)}`;
    case "cardio":
      return `${sign}${formatCardioDuration(abs)}`;
  }
}

/** The best result of all time, with its title for the card. */
export function bestResult(logType: LogType, points: ChartPoint[]): { title: string; value: string; note: string | null } | null {
  if (!points.length) return null;
  const best = points.reduce((a, b) => (b.value > a.value || (b.value === a.value && b.date > a.date) ? b : a));
  const title = logType === "time" || logType === "cardio" ? "Дольше всего" : logType === "weight_reps" ? "Лучший вес" : "Лучший подход";
  return { title, value: formatValue(logType, best.value), note: best.label };
}

