import type { ChartPoint, ExerciseSession } from "../chart-series";
import { formatNumber, plural } from "../format";
import { formatClock } from "../sets";
import type { Exercise, IsoDateTime, LogType, WorkoutSet } from "../types";
import { bestE1rm, isTimedSet } from "./e1rm";
import { STALL_DAYS, STALL_REPS_DROP, STALL_SESSIONS, STALL_TIME_STEP_SEC } from "./thresholds";
import { weightStep } from "./weight-step";

// «4 тренировки на одном уровне» (stage 41, mockup А1): the best result has not been beaten for a while.

const DAY_MS = 86_400_000;

export interface Stall {
  /** The workout that first reached the level. */
  since: IsoDateTime;
  /** Workouts on the level, that one included. */
  count: number;
  /** The level: ≈ максимум for «вес × раз» (or the best weight without sets of 1…12 reps), else the chart value. */
  value: number;
}

/**
 * A stall: the best point was first reached 4+ workouts ago (itself included) and 21+ days before the latest one.
 * A new best resets it. Points — the chart series in date order.
 */
export function stall(points: ChartPoint[]): Stall | null {
  if (points.length < STALL_SESSIONS) return null;
  const max = Math.max(...points.map((p) => p.value));
  const first = points.findIndex((p) => p.value === max);
  const count = points.length - first;
  const days = (new Date(points.at(-1)!.date).getTime() - new Date(points[first].date).getTime()) / DAY_MS;
  if (count < STALL_SESSIONS || days < STALL_DAYS - 0.5) return null;
  return { since: points[first].date, count, value: max };
}

export interface StallOption {
  label: string;
  value: string;
  /** «Сложнее вариант»: the value is a name, shown muted. */
  muted?: boolean;
}

const kg = (v: number) => formatNumber(v, 2);
const times = (n: number) => `${n} ${plural(n, ["раз", "раза", "раз"])}`;

/** The set the level stands on: the best ≈ максимум set, or the heaviest, or the longest — of the sessions on the level. */
function levelSet(logType: LogType, sessions: ExerciseSession[]): WorkoutSet | null {
  // isTimedSet is about sets with a weight; a timed exercise's sets all have a duration.
  const weighed = logType === "weight_reps" || logType === "bodyweight_plus";
  const sets = sessions.flatMap((s) => s.sets).filter((s) => s.done_at && !(weighed && isTimedSet(s)));
  if (!sets.length) return null;
  if (logType === "weight_reps") {
    const e = bestE1rm(sets);
    if (e) return e.set;
  }
  if (logType === "time") return sets.reduce((a, b) => ((b.duration_sec ?? 0) > (a.duration_sec ?? 0) ? b : a));
  return sets.reduce((a, b) => {
    const wa = a.weight ?? 0, wb = b.weight ?? 0;
    return wb > wa || (wb === wa && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a;
  });
}

/**
 * What to try next time (А1): «+1 повтор», «+2,5 кг, меньше повторов» (two reps fewer, as in the mockup: 22,5 × 10 →
 * 25 × 8), «Сложнее вариант» — the next level of the progression, if the exercise is in one.
 */
export function stallOptions(exercise: Pick<Exercise, "log_type" | "equipment">, sessionsOnLevel: ExerciseSession[], harder: string | null): StallOption[] {
  const set = levelSet(exercise.log_type, sessionsOnLevel);
  const out: StallOption[] = [];
  if (set) {
    const reps = set.reps ?? 0;
    switch (exercise.log_type) {
      case "weight_reps": {
        if (set.weight === null || set.weight <= 0) break;
        const step = weightStep(exercise.equipment);
        out.push({ label: "+1 повтор", value: `${kg(set.weight)} кг × ${reps + 1}` });
        out.push({ label: `+${kg(step)} кг, меньше повторов`, value: `${kg(set.weight + step)} кг × ${Math.max(1, reps - STALL_REPS_DROP)}` });
        break;
      }
      case "bodyweight_plus":
        out.push({ label: "+1 повтор", value: set.weight && set.weight > 0 ? `+${kg(set.weight)} кг × ${reps + 1}` : times(reps + 1) });
        break;
      case "reps":
        out.push({ label: "+1 повтор", value: times(reps + 1) });
        break;
      case "time":
        out.push({ label: `+${STALL_TIME_STEP_SEC} секунд`, value: formatClock((set.duration_sec ?? 0) + STALL_TIME_STEP_SEC) });
        break;
      case "cardio":
        break;
    }
  }
  if (harder) out.push({ label: "Сложнее вариант", value: harder, muted: true });
  return out;
}

/** «4 тренировки на одном уровне». */
export function stallTitle(count: number): string {
  return `${count} ${plural(count, ["тренировка", "тренировки", "тренировок"])} на одном уровне`;
}
