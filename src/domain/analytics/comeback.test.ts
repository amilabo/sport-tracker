import { describe, expect, it } from "vitest";
import { newEntity } from "../entity";
import { planChanges } from "../plan-diff";
import type { Equipment, Exercise, LogType, PlanSet, SetValues, Workout, WorkoutSet } from "../types";
import { newWorkoutExercise, newWorkoutSet } from "../workout";
import { comebackSets, daysSinceLast, isComeback, lowerWeight, planWeightNote } from "./comeback";
import { roundDownToStep, weightStep } from "./weight-step";

const ex = (log_type: LogType, equipment: Equipment): Exercise =>
  newEntity({ name: "x", muscle_group: "legs" as const, equipment, log_type, is_builtin: true, archived_at: null, progression_id: null, progression_level: null });
const v = (weight: number | null, reps: number | null): SetValues => ({ weight, reps, duration_sec: null, speed_kmh: null });
const planSets = (values: SetValues[]): WorkoutSet[] =>
  values.map((p, i) => newWorkoutSet("we", i, p, newEntity({ plan_exercise_id: "pe", position: i, ...p }) as PlanSet));
const w = (id: string, started_at: string, status: Workout["status"] = "finished") => ({ id, started_at, status });

describe("weightStep", () => {
  it("follows the equipment", () => {
    expect(weightStep("barbell")).toBe(2.5);
    expect(weightStep("machine")).toBe(2.5);
    expect(weightStep("cable")).toBe(2.5);
    expect(weightStep("dumbbells")).toBe(1);
    expect(weightStep("dumbbells_kettlebell")).toBe(1);
    expect(weightStep("kettlebell")).toBe(4);
    expect(weightStep("other")).toBe(2.5);
  });

  it("rounds down, not below one step and not above the weight", () => {
    expect(roundDownToStep(20.25, 2.5)).toBe(20);
    expect(roundDownToStep(20, 2.5)).toBe(20);
    expect(roundDownToStep(1.7, 2.5)).toBe(1.7);
    expect(roundDownToStep(3.4, 4)).toBe(3.4);
  });
});

describe("lowerWeight", () => {
  it("matches mockup А5 at −15 %", () => {
    expect(lowerWeight(45, 15, "barbell")).toBe(37.5);
    expect(lowerWeight(35, 15, "cable")).toBe(27.5);
    expect(lowerWeight(22.5, 15, "barbell")).toBe(17.5);
    expect(lowerWeight(10, 15, "dumbbells_kettlebell")).toBe(8);
  });

  it("at −10 % and as in the plan", () => {
    expect(lowerWeight(45, 10, "barbell")).toBe(40);
    expect(lowerWeight(22.5, 10, "barbell")).toBe(20);
    expect(lowerWeight(16, 10, "kettlebell")).toBe(12);
    expect(lowerWeight(45, 0, "barbell")).toBe(45);
  });
});

describe("daysSinceLast", () => {
  const now = new Date(2026, 9, 30, 9, 0);
  it("counts calendar days from the latest completed workout", () => {
    const list = [w("a", new Date(2026, 9, 12, 21, 0).toISOString()), w("b", new Date(2026, 9, 1).toISOString())];
    expect(daysSinceLast(list, now)).toBe(18);
    expect(isComeback(daysSinceLast(list, now))).toBe(true);
  });

  it("ignores workouts in progress, the excluded one and later ones; none — null", () => {
    const list = [
      w("a", new Date(2026, 9, 20).toISOString()),
      w("cur", new Date(2026, 9, 29).toISOString()),
      w("c", new Date(2026, 9, 28).toISOString(), "in_progress"),
      w("later", new Date(2026, 9, 31).toISOString()),
    ];
    expect(daysSinceLast(list, now, "cur")).toBe(10);
    expect(isComeback(10)).toBe(false);
    expect(isComeback(14)).toBe(true);
    expect(daysSinceLast([], now)).toBeNull();
    expect(isComeback(null)).toBe(false);
  });
});

describe("comebackSets", () => {
  it("lowers plan weights of «вес × раз» and puts them back with 0", () => {
    const sets = planSets([v(45, 15), v(45, 15)]);
    const low = comebackSets(ex("weight_reps", "barbell"), sets, 15);
    expect(low.map((s) => s.weight)).toEqual([37.5, 37.5]);
    expect(planWeightNote(low, String)).toBe("в плане 45 кг");
    const back = comebackSets(ex("weight_reps", "barbell"), low, 0);
    expect(back.map((s) => s.weight)).toEqual([45, 45]);
    expect(planWeightNote(back, String)).toBeNull();
  });

  it("leaves own weight, assistance, cardio and sets without a planned weight", () => {
    const pull = planSets([v(-20, 8)]);
    expect(comebackSets(ex("bodyweight_plus", "bodyweight"), pull, 15)).toBe(pull);
    const reps = planSets([v(null, 15)]);
    expect(comebackSets(ex("weight_reps", "bodyweight"), reps, 15)[0]).toBe(reps[0]);
    const added = [newWorkoutSet("we", 0, v(20, 10))];
    expect(comebackSets(ex("weight_reps", "barbell"), added, 15)[0]).toBe(added[0]);
  });

  it("names different planned weights", () => {
    const low = comebackSets(ex("weight_reps", "barbell"), planSets([v(40, 10), v(45, 10)]), 10);
    expect(planWeightNote(low, String)).toBe("в плане 40 · 45 кг");
  });
});

describe("planChanges after a break", () => {
  const done = (sets: WorkoutSet[], values: SetValues[]) => sets.map((s, i) => ({ ...s, ...values[i], done_at: "2026-10-30T07:00:00.000Z" }));
  const item = (sets: WorkoutSet[]) => ({ we: newWorkoutExercise("w", "e", 0), exercise: ex("weight_reps", "barbell"), replaced: null, sets });

  it("does not offer the lowered weight, but keeps raises and reps", () => {
    const sets = done(planSets([v(45, 15), v(45, 15)]), [v(37.5, 15), v(37.5, 12)]);
    expect(planChanges([item(sets)]).map((c) => `${c.where}: ${c.from} → ${c.to}`)).toEqual([
      "все 2 подхода: 45 кг → 37,5 кг",
      "подход 2: 15 раз → 12 раз",
    ]);
    expect(planChanges([item(sets)], { comeback: true }).map((c) => `${c.where}: ${c.from} → ${c.to}`)).toEqual(["подход 2: 15 раз → 12 раз"]);
    const up = done(planSets([v(45, 15)]), [v(47.5, 15)]);
    expect(planChanges([item(up)], { comeback: true }).map((c) => c.to)).toEqual(["47,5 кг"]);
  });
});
