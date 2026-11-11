import type { Exercise, IsoDateTime, WorkoutExercise, WorkoutSet } from "../types";
import { isTimedSet } from "./e1rm";
import { CEILING_REPS_DROP, repCeiling, repStep, sideFactor, stepOf } from "./progress-settings";
import { DOUBLE_PROGRESSION_RUNS, STALL_DAYS, STALL_SESSIONS } from "./thresholds";

// What «Обновить план?» can offer for one plan line (stage 51а; the screen — stage 52, mockup Р1). Decisions of 11.11.2026:
// - two workouts in a row at the plan → «+1 повтор» or «+шаг веса» (weight first until the person picks reps once);
// - at the ceiling of reps (15 by default) → «+1 подход» or «+шаг веса, меньше повторов» (double progression);
// - the plan line unchanged for 4 workouts and 21+ days, done in full today → «+1 повтор / +1 подход / +шаг веса».
// «На каждую сторону»: the plan keeps the sum, so the ceiling and +1 are per side (×2 of the sum).
// Only «вес × раз» and «только раз»; one weight and one rep count across the planned sets (a pyramid has no «next»).

/** Plan line values: all planned sets alike. `weight` — null for «только раз». */
export interface LineValues {
  sets: number;
  reps: number;
  weight: number | null;
}

/** reps — +1 (per side); weight — +step, same reps; weight_reset — +step and reps down from the ceiling; set — one more set. */
export type OptionKind = "reps" | "weight" | "weight_reset" | "set";

export interface ProgressOption {
  kind: OptionKind;
  to: LineValues;
}

/** double — two workouts at the plan; ceiling — the same at the ceiling of reps; stall — the plan has not changed for long. */
export type ProgressReason = "double" | "ceiling" | "stall";

export interface ProgressSuggestion {
  reason: ProgressReason;
  from: LineValues;
  /** First — the one offered by default. */
  options: ProgressOption[];
  /** How many workouts in a row the line has been the same, this one included. */
  runs: number;
  /** The first of those workouts (stall: «без изменений с 14.10»). */
  since: IsoDateTime;
}

/** More sets than this are not offered. */
export const MAX_PLAN_SETS = 10;

type We = Pick<WorkoutExercise, "skipped" | "replaced_exercise_id">;

export interface OptionsItem {
  we: We;
  exercise: Pick<Exercise, "log_type" | "equipment" | "weight_step" | "rep_ceiling" | "per_side" | "progress_prefer">;
  replaced?: unknown;
  sets: WorkoutSet[];
}

/** The same plan line in an earlier completed workout by the same plan. */
export interface PastLine {
  started_at: IsoDateTime;
  we: We;
  sets: WorkoutSet[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The plan line of a workout: planned sets alike and countable, else null. */
function lineOf(sets: WorkoutSet[], withWeight: boolean): LineValues | null {
  const planned = sets.filter((s) => s.plan_set_id);
  if (!planned.length || planned.some(isTimedSet)) return null;
  const reps = new Set(planned.map((s) => s.target_reps));
  const weights = new Set(planned.map((s) => s.target_weight));
  if (reps.size !== 1 || (withWeight && weights.size !== 1)) return null;
  const r = planned[0].target_reps;
  const w = withWeight ? planned[0].target_weight : null;
  if (r === null || r <= 0 || (withWeight && (w === null || w <= 0))) return null;
  return { sets: planned.length, reps: r, weight: w };
}

function sameLine(a: LineValues, b: LineValues | null): boolean {
  return !!b && a.sets === b.sets && a.reps === b.reps && a.weight === b.weight;
}

/** All planned sets done, each at least at the line's weight and reps. */
function atTarget(sets: WorkoutSet[], line: LineValues): boolean {
  const planned = sets.filter((s) => s.plan_set_id);
  return (
    planned.length === line.sets &&
    planned.every((s) => s.done_at && !isTimedSet(s) && (s.reps ?? 0) >= line.reps && (line.weight === null || (s.weight ?? 0) >= line.weight))
  );
}

function usable(we: We, replaced?: unknown): boolean {
  return !we.skipped && !we.replaced_exercise_id && !replaced;
}

/**
 * The suggestion for one plan line of the workout started at `startedAt`, or null. `past` — the same line in earlier
 * completed workouts by the same plan, newest first (as many as there are; 4 are enough for the stall).
 */
export function progressSuggestion(item: OptionsItem, startedAt: IsoDateTime, past: PastLine[]): ProgressSuggestion | null {
  const ex = item.exercise;
  if ((ex.log_type !== "weight_reps" && ex.log_type !== "reps") || !usable(item.we, item.replaced)) return null;
  const withWeight = ex.log_type === "weight_reps";
  const line = lineOf(item.sets, withWeight);
  // Today not done in full: first the plan itself.
  if (!line || !atTarget(item.sets, line)) return null;

  // The run of workouts with this very line, today included.
  let runs = 1;
  let since = startedAt;
  for (const p of past) {
    if (!usable(p.we) || !sameLine(line, lineOf(p.sets, withWeight))) break;
    runs++;
    since = p.started_at;
  }
  const stall = runs >= STALL_SESSIONS && Date.parse(startedAt) - Date.parse(since) >= STALL_DAYS * DAY_MS;
  const prev = past[0];
  const double = runs >= DOUBLE_PROGRESSION_RUNS && !!prev && atTarget(prev.sets, line);
  if (!stall && !double) return null;

  const ceiling = repCeiling(ex);
  const atCeiling = line.reps >= ceiling;
  const options: ProgressOption[] = [];
  const add = (kind: OptionKind, to: Partial<LineValues>) => options.push({ kind, to: { ...line, ...to } });

  // Heavier: one step, or what was actually done today if that is more (as «Пора добавить вес» did).
  const done = item.sets.filter((s) => s.plan_set_id && s.done_at);
  const doneMax = Math.max(0, ...done.map((s) => s.weight ?? 0));
  const heavier = line.weight !== null ? round2(Math.max(line.weight + stepOf(ex), doneMax)) : null;
  // More reps: +1, or what every set actually had today if that is more — still not above the ceiling.
  const doneMinReps = Math.min(...done.map((s) => s.reps ?? 0));
  const canSet = line.sets < MAX_PLAN_SETS;

  if (!atCeiling) {
    add("reps", { reps: Math.min(Math.max(line.reps + repStep(ex), doneMinReps), ceiling) });
    if (stall && canSet) add("set", { sets: line.sets + 1 });
    if (heavier !== null) add("weight", { weight: heavier });
  } else {
    if (canSet) add("set", { sets: line.sets + 1 });
    if (heavier !== null) add("weight_reset", { weight: heavier, reps: Math.max(repStep(ex), ceiling - CEILING_REPS_DROP * sideFactor(ex)) });
  }
  if (!options.length) return null;

  // First — what the person chose last time for this exercise; until then weight, as before (stage 41).
  const reps = ex.progress_prefer === "reps";
  const isWeight = (k: OptionKind) => k === "weight" || k === "weight_reset";
  options.sort((a, b) => Number(isWeight(a.kind) === reps) - Number(isWeight(b.kind) === reps));

  return { reason: stall ? "stall" : atCeiling ? "ceiling" : "double", from: line, options, runs, since };
}
