import { describe, expect, it } from "vitest";
import { newEntity } from "./entity";
import type { Exercise, PlanExercise, PlanSet, SetValues, Workout, WorkoutSet } from "./types";
import {
  buildWorkout,
  fieldsFor,
  isExerciseDone,
  isFieldChanged,
  isStale,
  lastActivity,
  lastTimeDiffers,
  newWorkoutSet,
  parseSignedWeight,
  progress,
  stepValue,
} from "./workout";

const v = (weight: number | null, reps: number | null): SetValues => ({ weight, reps, duration_sec: null, speed_kmh: null });

function planSet(values: SetValues, position = 0): PlanSet {
  return newEntity({ plan_exercise_id: "pe", position, ...values });
}

const exercise = newEntity({
  name: "Жим лёжа",
  muscle_group: "chest" as const,
  equipment: "barbell" as const,
  log_type: "weight_reps" as const,
  is_builtin: true,
  archived_at: null,
  progression_id: null,
  progression_level: null,
}) as Exercise;

const pe: PlanExercise = newEntity({ plan_id: "p", exercise_id: exercise.id, position: 0, note: "узкий хват" });

describe("buildWorkout", () => {
  it("copies plan sets as values and as targets", () => {
    const sets = [planSet(v(40, 12), 0), planSet(v(45, 10), 1)];
    const r = buildWorkout("p", [{ planExercise: pe, exercise, sets }], "2026-10-15T06:24:00.000Z");
    expect(r.workout).toMatchObject({ plan_id: "p", status: "in_progress", started_at: "2026-10-15T06:24:00.000Z", finished_at: null });
    expect(r.exercises).toHaveLength(1);
    expect(r.exercises[0]).toMatchObject({ workout_id: r.workout.id, exercise_id: exercise.id, plan_exercise_id: pe.id, skipped: false });
    expect(r.sets.map((s) => [s.weight, s.reps, s.target_weight, s.target_reps, s.plan_set_id, s.done_at])).toEqual([
      [40, 12, 40, 12, sets[0].id, null],
      [45, 10, 45, 10, sets[1].id, null],
    ]);
  });

  it("free workout has no exercises", () => {
    const r = buildWorkout(null, [], "2026-10-15T06:24:00.000Z");
    expect(r.workout.plan_id).toBeNull();
    expect(r.exercises).toEqual([]);
  });
});

describe("steps", () => {
  it("uses PRD steps and clamps at zero except assistance", () => {
    expect(stepValue("weight_reps", "weight", 40, 1)).toBe(42.5);
    expect(stepValue("weight_reps", "weight", 1, -1)).toBe(0);
    expect(stepValue("weight_reps", "weight", null, 1)).toBe(2.5);
    expect(stepValue("bodyweight_plus", "weight", 0, -1)).toBe(-2.5);
    expect(stepValue("reps", "reps", 12, -1)).toBe(11);
    expect(stepValue("time", "duration_sec", 30, 1)).toBe(35);
    expect(stepValue("cardio", "duration_sec", 900, 1)).toBe(960);
    expect(stepValue("cardio", "speed_kmh", 10, -1)).toBe(9.5);
  });

  it("fields per log type", () => {
    expect(fieldsFor("weight_reps")).toEqual(["weight", "reps"]);
    expect(fieldsFor("cardio")).toEqual(["duration_sec", "speed_kmh"]);
    expect(fieldsFor("time")).toEqual(["duration_sec"]);
  });
});

describe("done, changed, progress", () => {
  const ps = planSet(v(40, 12));
  const set = (patch: Partial<WorkoutSet>): WorkoutSet => ({ ...newWorkoutSet("we", 0, v(40, 12), ps), ...patch });

  it("an exercise is done when all its sets are", () => {
    expect(isExerciseDone([])).toBe(false);
    expect(isExerciseDone([set({ done_at: "t" }), set({ done_at: null })])).toBe(false);
    expect(isExerciseDone([set({ done_at: "t" })])).toBe(true);
  });

  it("marks fields that differ from the plan target", () => {
    expect(isFieldChanged(set({ weight: 42.5 }), "weight")).toBe(true);
    expect(isFieldChanged(set({ weight: 42.5 }), "reps")).toBe(false);
    // Added sets have no target: nothing is "changed".
    expect(isFieldChanged({ ...newWorkoutSet("we", 1, v(50, 8)) }, "weight")).toBe(false);
  });

  it("counts done exercises, skipped ones are not done", () => {
    const we = (skipped: boolean) => ({ ...newEntity({ workout_id: "w", exercise_id: "e", replaced_exercise_id: null, plan_exercise_id: null, position: 0, skipped, note: null }) });
    expect(
      progress([
        { we: we(false), sets: [set({ done_at: "t" })] },
        { we: we(true), sets: [set({ done_at: "t" })] },
        { we: we(false), sets: [set({})] },
      ]),
    ).toEqual({ done: 1, total: 3 });
  });
});

describe("last time", () => {
  const sets = [newWorkoutSet("we", 0, v(40, 10), planSet(v(40, 10))), newWorkoutSet("we", 1, v(40, 10), planSet(v(40, 10), 1))];

  it("is hidden when it matches the plan or there is no history", () => {
    expect(lastTimeDiffers(sets, undefined)).toBe(false);
    expect(lastTimeDiffers(sets, [v(40, 10), v(40, 10)])).toBe(false);
  });

  it("is shown when values or set count differ", () => {
    expect(lastTimeDiffers(sets, [v(42.5, 10), v(40, 10)])).toBe(true);
    expect(lastTimeDiffers(sets, [v(40, 10)])).toBe(true);
  });
});

describe("stale workouts", () => {
  const w = (started_at: string, status: Workout["status"] = "in_progress") =>
    newEntity({
      plan_id: null, started_at, finished_at: null, status, wellbeing_before: null, mood_before: null,
      energy_after: null, mood_after: null, note: null, plan_update_prompted: false,
    }) as Workout;

  it("a workout from an earlier local day is stale, from today is not", () => {
    const now = new Date(2026, 9, 15, 0, 30);
    expect(isStale(w(new Date(2026, 9, 14, 23, 50).toISOString()), now)).toBe(true);
    expect(isStale(w(new Date(2026, 9, 15, 0, 10).toISOString()), now)).toBe(false);
    expect(isStale(w(new Date(2026, 9, 14, 9, 0).toISOString(), "finished"), now)).toBe(false);
  });

  it("last activity is the latest done set", () => {
    const workout = w("2026-10-14T06:00:00.000Z");
    const s1 = { ...newWorkoutSet("we", 0, v(1, 1)), done_at: "2026-10-14T06:40:00.000Z" };
    const s2 = { ...newWorkoutSet("we", 1, v(1, 1)), done_at: "2026-10-14T06:20:00.000Z" };
    expect(lastActivity(workout, [s1, s2])).toBe("2026-10-14T06:40:00.000Z");
    expect(lastActivity(workout, [])).toBe("2026-10-14T06:00:00.000Z");
  });
});

describe("assistance minus without a «−» key", () => {
  it("an unsigned number keeps the minus of the exercise's known weight", () => {
    expect(parseSignedWeight("20", [-25])).toBe(-20);
    expect(parseSignedWeight("17,5", [null, 0, -20])).toBe(-17.5);
    expect(parseSignedWeight("20", [10])).toBe(20);
    expect(parseSignedWeight("20", [null])).toBe(20);
  });

  it("an explicit sign wins", () => {
    expect(parseSignedWeight("+10", [-25])).toBe(10);
    expect(parseSignedWeight("−20", [10])).toBe(-20);
    expect(parseSignedWeight("0", [-25])).toBe(0);
    expect(parseSignedWeight("+-5", [])).toBeNull();
    expect(parseSignedWeight("abc", [])).toBeNull();
  });
});
