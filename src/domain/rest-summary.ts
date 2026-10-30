// Work and rest after a workout with rest (stage 37): totals, rest over the plan, «Обновить отдых в плане?».
import { formatRest, setRestFor, REST_STEP } from "./rest";
import type { Exercise, Id, RestSnapshot, WorkoutExercise, WorkoutSet } from "./types";

/** Rest longer than planned by more than this is pointed out. */
export const LONG_REST_OVER_SEC = 30;

type SummaryItem = { we: Pick<WorkoutExercise, "skipped">; sets: Pick<WorkoutSet, "done_at" | "rest_sec" | "rest_target_sec" | "rest_approx">[] };

export interface RestSummary {
  /** All recorded rest, seconds. */
  restSec: number;
  /** How many rests were recorded. */
  count: number;
  /** Of them recorded without «Начать подход» («≈»: the set itself is inside). */
  approxCount: number;
  /** Average of (actual − planned) over exact rests; null — none to compare. */
  avgOverSec: number | null;
  /** Rests longer than planned by more than 30 s. */
  longCount: number;
}

/** null — no rest was recorded (a «Силовая» workout, or the timer was not used). */
export function restSummary(items: SummaryItem[]): RestSummary | null {
  const rests = items.flatMap((i) => i.sets.filter((s) => s.done_at && s.rest_sec !== undefined));
  if (!rests.length) return null;
  const exact = rests.filter((s) => !s.rest_approx && s.rest_target_sec !== undefined);
  const over = exact.map((s) => s.rest_sec! - s.rest_target_sec!);
  return {
    restSec: rests.reduce((sum, s) => sum + s.rest_sec!, 0),
    count: rests.length,
    approxCount: rests.length - exact.length,
    avgOverSec: over.length ? Math.round(over.reduce((a, b) => a + b, 0) / over.length) : null,
    longCount: exact.filter((s) => s.rest_sec! > s.rest_target_sec! + LONG_REST_OVER_SEC).length,
  };
}

/** «Отдыхали в среднем на 0:23 дольше плана», «…короче плана», «как в плане». */
export function overText(sec: number): string {
  if (Math.abs(sec) < 5) return "Отдыхали как в плане";
  return `Отдыхали в среднем на ${formatRest(Math.abs(sec))} ${sec > 0 ? "дольше" : "короче"} плана`;
}

export interface RestUpdate {
  key: string;
  exerciseName: string;
  planExerciseId: Id;
  fromSec: number;
  toSec: number;
}

type UpdateItem = {
  we: Pick<WorkoutExercise, "id" | "skipped" | "plan_exercise_id" | "rest_set_sec" | "circuit_id">;
  exercise: Pick<Exercise, "name">;
  replaced: unknown;
  sets: Pick<WorkoutSet, "done_at" | "rest_sec" | "rest_approx">[];
};

/**
 * «Обновить отдых в плане?»: an exercise of the plan whose rest between sets was measured exactly at least twice,
 * and on average differs from the plan by 15 s or more (suggested — rounded to 15 s). Circuits, replaced and skipped exercises are left out.
 */
export function restUpdates(items: UpdateItem[], snapshot: RestSnapshot | undefined): RestUpdate[] {
  if (!snapshot) return [];
  const out: RestUpdate[] = [];
  for (const item of items) {
    if (item.replaced || item.we.skipped || item.we.circuit_id || !item.we.plan_exercise_id) continue;
    // Rest before set 2, 3… — between sets of this exercise (before set 1 it is between exercises).
    const measured = item.sets.slice(1).filter((s) => s.done_at && s.rest_sec !== undefined && !s.rest_approx);
    if (measured.length < 2) continue;
    const avg = measured.reduce((sum, s) => sum + s.rest_sec!, 0) / measured.length;
    const to = Math.round(avg / REST_STEP) * REST_STEP;
    const from = setRestFor(snapshot, item.we.rest_set_sec);
    if (Math.abs(avg - from) < REST_STEP || to === from) continue;
    out.push({ key: `rest:${item.we.id}`, exerciseName: item.exercise.name, planExerciseId: item.we.plan_exercise_id, fromSec: from, toSec: to });
  }
  return out;
}
