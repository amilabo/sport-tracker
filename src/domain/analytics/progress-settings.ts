import type { Exercise } from "../types";
import { weightStep } from "./weight-step";

// «Как прибавлять» (stage 51а, decisions of 11.11.2026): the ceiling of reps, own weight step, «на каждую сторону».
// Settings of the exercise, the same in every plan (mockup Р4); the defaults keep the old behaviour.

/** The top of the rep range when nothing is set: «обычно 15, у некоторых 16» — for exercises with a weight. */
export const REP_CEILING_DEFAULT = 15;
/** «Только раз» (froggies, 4 × 20): no weight to add, so the ceiling only switches +1 rep to +1 set — higher. */
export const REP_CEILING_DEFAULT_REPS = 30;
export const REP_CEILING_MIN = 5;
export const REP_CEILING_MAX = 50;
/** A heavier weight starts this many reps below the ceiling (15 → 12). Confirmed by the person on 11.11.2026. */
export const CEILING_REPS_DROP = 3;
/** Own weight step, kg. */
export const WEIGHT_STEP_MIN = 0.25;
export const WEIGHT_STEP_MAX = 50;

type Settings = Pick<Exercise, "equipment" | "rep_ceiling" | "weight_step" | "per_side"> & { log_type?: Exercise["log_type"] };

export function perSide(exercise: Pick<Exercise, "per_side">): boolean {
  return exercise.per_side === true;
}

/** Reps of one side: the plan keeps the sum, so it is ×2 for «на каждую сторону». */
export function sideFactor(exercise: Pick<Exercise, "per_side">): 1 | 2 {
  return perSide(exercise) ? 2 : 1;
}

/** The ceiling as written in the plan (the sum of both sides for «на каждую сторону»). */
export function repCeiling(exercise: Pick<Settings, "rep_ceiling" | "per_side" | "log_type">): number {
  const byDefault = exercise.log_type === "reps" ? REP_CEILING_DEFAULT_REPS : REP_CEILING_DEFAULT;
  return (cleanCeiling(exercise.rep_ceiling) ?? byDefault) * sideFactor(exercise);
}

/** +1 rep — per side, so +2 to the sum for «на каждую сторону». */
export function repStep(exercise: Pick<Exercise, "per_side">): number {
  return sideFactor(exercise);
}

/** The exercise's weight step: its own, else by equipment. */
export function stepOf(exercise: Pick<Settings, "equipment" | "weight_step">): number {
  return cleanStep(exercise.weight_step) ?? weightStep(exercise.equipment);
}

/** A stored ceiling: a whole number within 5…50; anything else (absent, broken import) — null, the default. */
export function cleanCeiling(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= REP_CEILING_MIN && n <= REP_CEILING_MAX ? n : null;
}

/** A stored step: 0,25…50 kg, to 0,01; anything else — null, the equipment's step. */
export function cleanStep(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value * 100) / 100;
  return n >= WEIGHT_STEP_MIN && n <= WEIGHT_STEP_MAX ? n : null;
}
