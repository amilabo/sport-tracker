import { newEntity, touch } from "./entity";
import { parseDecimal } from "./format";
import { toLocalDate } from "./time";
import type {
  Exercise,
  Id,
  IsoDateTime,
  LogType,
  PlanExercise,
  PlanSet,
  SetValues,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "./types";

export type SetField = keyof SetValues;

/** −/+ steps (PRD §3.3): weight ±2.5 kg, reps ±1, time ±5 s; cardio: ±1 min and ±0.5 km/h. */
export function stepFor(logType: LogType, field: SetField): number {
  if (field === "weight") return 2.5;
  if (field === "reps") return 1;
  if (field === "speed_kmh") return 0.5;
  return logType === "cardio" ? 60 : 5;
}

/** Fields shown for a set, in display order. */
export function fieldsFor(logType: LogType): SetField[] {
  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus":
      return ["weight", "reps"];
    case "reps":
      return ["reps"];
    case "time":
      return ["duration_sec"];
    case "cardio":
      return ["duration_sec", "speed_kmh"];
  }
}

/**
 * Typed weight of a bodyweight_plus set. The phone's number pad often has no "−": a number typed
 * without a sign keeps the minus (assistance, like the gravitron) when the first known weight in
 * `reference` (this set, other sets, last time) is negative. "+10" is always extra weight, "−20" assistance.
 */
export function parseSignedWeight(text: string, reference: (number | null)[]): number | null {
  const t = text.trim();
  const plus = t.startsWith("+");
  const v = parseDecimal(plus ? t.slice(1) : t);
  if (v === null || (plus && v < 0)) return null;
  if (plus || v <= 0 || /^[-−–]/.test(t)) return v;
  const known = reference.find((w) => w !== null && w !== 0);
  return known !== undefined && known !== null && known < 0 ? -v : v;
}

export function stepValue(logType: LogType, field: SetField, value: number | null, dir: 1 | -1): number {
  const step = stepFor(logType, field);
  const next = Math.round(((value ?? 0) + dir * step) * 100) / 100;
  // Only bodyweight_plus may go below zero (assistance).
  if (logType === "bodyweight_plus" && field === "weight") return Math.max(-999, Math.min(999, next));
  return Math.max(0, next);
}

export function isSetChanged(set: WorkoutSet): boolean {
  if (!set.plan_set_id) return false;
  return (
    set.weight !== set.target_weight ||
    set.reps !== set.target_reps ||
    set.duration_sec !== set.target_duration_sec ||
    set.speed_kmh !== set.target_speed_kmh
  );
}

export function isFieldChanged(set: WorkoutSet, field: SetField): boolean {
  if (!set.plan_set_id) return false;
  const target = { weight: set.target_weight, reps: set.target_reps, duration_sec: set.target_duration_sec, speed_kmh: set.target_speed_kmh }[field];
  return set[field] !== target;
}

export function isExerciseDone(sets: WorkoutSet[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done_at !== null);
}

export interface ProgressItem {
  we: WorkoutExercise;
  sets: WorkoutSet[];
}

export function progress(items: ProgressItem[]): { done: number; total: number } {
  return { done: items.filter((i) => !i.we.skipped && isExerciseDone(i.sets)).length, total: items.length };
}

/**
 * "В прошлый раз" (PRD §3.3): shown only if last time's result differs from the plan targets.
 * Compares set by set; a different set count also counts as a difference.
 */
export function lastTimeDiffers(current: WorkoutSet[], last: SetValues[] | undefined): boolean {
  if (!last || last.length === 0) return false;
  const targets = current.filter((s) => s.plan_set_id);
  if (targets.length === 0) return false;
  if (targets.length !== last.length) return true;
  return targets.some(
    (t, i) =>
      t.target_weight !== last[i].weight ||
      t.target_reps !== last[i].reps ||
      t.target_duration_sec !== last[i].duration_sec ||
      t.target_speed_kmh !== last[i].speed_kmh,
  );
}

/** A workout left in progress on an earlier calendar day is finished automatically (PRD §3.13). */
export function isStale(workout: Workout, now: Date = new Date()): boolean {
  return workout.status === "in_progress" && toLocalDate(new Date(workout.started_at)) < toLocalDate(now);
}

/** Time of the last thing done in a workout: the latest done set, else the start. */
export function lastActivity(workout: Workout, sets: WorkoutSet[]): IsoDateTime {
  return sets.reduce<IsoDateTime>((acc, s) => (s.done_at && s.done_at > acc ? s.done_at : acc), workout.started_at);
}

export interface PlanSnapshotItem {
  planExercise: PlanExercise;
  exercise: Exercise;
  sets: PlanSet[];
}

export interface NewWorkoutRecords {
  workout: Workout;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
}

export function newWorkoutSet(workoutExerciseId: Id, position: number, values: SetValues, planSet?: PlanSet): WorkoutSet {
  return newEntity({
    workout_exercise_id: workoutExerciseId,
    position,
    weight: values.weight,
    reps: values.reps,
    duration_sec: values.duration_sec,
    speed_kmh: values.speed_kmh,
    done_at: null,
    plan_set_id: planSet?.id ?? null,
    target_weight: planSet?.weight ?? null,
    target_reps: planSet?.reps ?? null,
    target_duration_sec: planSet?.duration_sec ?? null,
    target_speed_kmh: planSet?.speed_kmh ?? null,
  });
}

export function newWorkoutExercise(workoutId: Id, exerciseId: Id, position: number, planExercise?: PlanExercise): WorkoutExercise {
  return newEntity({
    workout_id: workoutId,
    exercise_id: exerciseId,
    replaced_exercise_id: null,
    plan_exercise_id: planExercise?.id ?? null,
    position,
    skipped: false,
    note: null,
  });
}

/** A new workout: from a plan (sets pre-filled with plan values, targets snapshotted) or empty. */
export function buildWorkout(planId: Id | null, items: PlanSnapshotItem[], at: IsoDateTime): NewWorkoutRecords {
  const workout: Workout = newEntity(
    {
      plan_id: planId,
      started_at: at,
      finished_at: null,
      status: "in_progress" as const,
      wellbeing_before: null,
      mood_before: null,
      energy_after: null,
      mood_after: null,
      note: null,
      plan_update_prompted: false,
    },
    { at },
  );
  const exercises: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];
  items.forEach((item, position) => {
    const we = newWorkoutExercise(workout.id, item.exercise.id, position, item.planExercise);
    exercises.push(we);
    item.sets.forEach((ps, i) => sets.push(newWorkoutSet(we.id, i, ps, ps)));
  });
  return { workout, exercises, sets };
}

const EMPTY_VALUES: SetValues = { weight: null, reps: null, duration_sec: null, speed_kmh: null };

function valuesOf({ weight, reps, duration_sec, speed_kmh }: SetValues): SetValues {
  return { weight, reps, duration_sec, speed_kmh };
}

/** An exercise added on the fly, at `position`: sets start from last time's result, or one empty set. */
export function addedExercise(workoutId: Id, exerciseId: Id, position: number, last: SetValues[] | undefined) {
  const we = newWorkoutExercise(workoutId, exerciseId, position);
  const values = last?.length ? last : [EMPTY_VALUES];
  return { we, sets: values.map((v, i) => newWorkoutSet(we.id, i, v)) };
}

/**
 * Replaces the exercise for today only (PRD §3.4): the plan is untouched, history keeps "instead of".
 * Sets start from last time's result for the new exercise; without history — the current values
 * (same log type) or empty sets. Plan targets no longer apply to a replacement and are cleared.
 * Returns the updated workout exercise and its new sets (the old sets are to be deleted).
 */
export function replacedExercise(
  we: WorkoutExercise,
  oldLogType: LogType | undefined,
  sets: WorkoutSet[],
  exercise: Exercise,
  last: SetValues[] | undefined,
) {
  const original = we.replaced_exercise_id ?? we.exercise_id;
  const updated = touch(we, {
    exercise_id: exercise.id,
    replaced_exercise_id: original === exercise.id ? null : original,
  });
  const values = last?.length ? last : oldLogType === exercise.log_type ? sets.map(valuesOf) : sets.map(() => EMPTY_VALUES);
  return { we: updated, sets: values.map((v, i) => newWorkoutSet(updated.id, i, v)) };
}
