import { plural } from "../format";
import type { Exercise, WorkoutExercise, WorkoutSet } from "../types";
import { isTimedSet } from "./e1rm";
import { DOUBLE_PROGRESSION_RUNS } from "./thresholds";
import { weightStep } from "./weight-step";

// «Пора добавить вес» (stage 41, mockup А2) — double progression: the planned reps are done at the planned weight in all
// planned sets two workouts in a row, so the weight goes up by one step. Plans have no rep range, so the top of the
// range is the plan's reps.

export interface DoubleProgression {
  /** The plan's weight now and the suggested one. */
  from: number;
  to: number;
  reps: number;
}

export interface ProgressionItem {
  we: Pick<WorkoutExercise, "skipped" | "replaced_exercise_id">;
  exercise: Pick<Exercise, "log_type" | "equipment">;
  replaced?: unknown;
  sets: WorkoutSet[];
}

/** The same plan line in the previous workout: what was done there. */
export type PreviousItem = Pick<ProgressionItem, "we" | "sets">;

/** All planned sets done, none on a timer, each at least at the weight and reps given. */
function allAtTarget(sets: WorkoutSet[], weight: number, reps: number): boolean {
  const planned = sets.filter((s) => s.plan_set_id);
  return planned.length > 0 && planned.every((s) => s.done_at && !isTimedSet(s) && (s.weight ?? 0) >= weight && (s.reps ?? 0) >= reps);
}

/**
 * The suggestion for one plan exercise, or null. `previous` — the same plan line in the latest completed workout by the
 * same plan before this one (null — none, or it was replaced or skipped there). Only «вес × раз» with one weight and
 * one rep count across the planned sets: a pyramid has no single «next weight».
 */
export function doubleProgression(item: ProgressionItem, previous: PreviousItem | null): DoubleProgression | null {
  if (item.exercise.log_type !== "weight_reps" || item.replaced || item.we.replaced_exercise_id || item.we.skipped) return null;
  const planned = item.sets.filter((s) => s.plan_set_id);
  const weights = new Set(planned.map((s) => s.target_weight));
  const repsSet = new Set(planned.map((s) => s.target_reps));
  if (!planned.length || weights.size !== 1 || repsSet.size !== 1) return null;
  const weight = planned[0].target_weight;
  const reps = planned[0].target_reps;
  if (weight === null || weight <= 0 || reps === null || reps <= 0) return null;
  if (!allAtTarget(item.sets, weight, reps)) return null;
  // DOUBLE_PROGRESSION_RUNS = 2: this workout and the previous one.
  const runs = [previous].slice(0, DOUBLE_PROGRESSION_RUNS - 1);
  if (runs.some((p) => !p || p.we.skipped || p.we.replaced_exercise_id || !allAtTarget(p.sets, weight, reps))) return null;
  return { from: weight, to: Math.round((weight + weightStep(item.exercise.equipment)) * 100) / 100, reps };
}

/** The grey line of the plan change: «все подходы · 2 тренировки подряд по 15 раз — пора добавить вес». */
export function doubleProgressionWhere(reps: number): string {
  return `все подходы · ${DOUBLE_PROGRESSION_RUNS} тренировки подряд по ${reps} ${plural(reps, ["разу", "раза", "раз"])} — пора добавить вес`;
}
