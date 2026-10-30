import { describe, expect, it } from "vitest";
import { chartSeries, type ExerciseSession } from "../chart-series";
import { newEntity } from "../entity";
import { planChanges } from "../plan-diff";
import type { Equipment, Exercise, LogType, PlanSet, SetValues, WorkoutSet } from "../types";
import { newWorkoutExercise, newWorkoutSet } from "../workout";
import { doubleProgression, doubleProgressionWhere } from "./double-progression";
import { stall, stallOptions, stallTitle } from "./stall";

const v = (weight: number | null, reps: number | null, duration_sec: number | null = null): SetValues => ({ weight, reps, duration_sec, speed_kmh: null });
const doneSets = (values: SetValues[]): WorkoutSet[] => values.map((x, i) => ({ ...newWorkoutSet("we", i, x), done_at: "2026-10-01T08:00:00.000Z" }));
const session = (date: string, values: SetValues[]): ExerciseSession => ({ workoutId: `w-${date}`, startedAt: `${date}T08:00:00.000Z`, sets: doneSets(values) });
const four = (w: number, r: number) => [v(w, r), v(w, r), v(w, r), v(w, r)];
const ex = (log_type: LogType, equipment: Equipment): Exercise =>
  newEntity({ name: "Ягодичный мост со штангой", muscle_group: "glutes" as const, equipment, log_type, is_builtin: true, archived_at: null, progression_id: null, progression_level: null });

// Mockup А1: up to 30.09, then 4 workouts at ≈ 30 kg.
const rdl: ExerciseSession[] = [
  session("2026-09-02", four(17.5, 12)),
  session("2026-09-09", four(20, 10)),
  session("2026-09-16", [v(20, 12), v(20, 12), v(20, 10), v(20, 10)]),
  session("2026-09-23", four(22.5, 8)),
  session("2026-09-30", [v(22.5, 10), v(22.5, 10), v(20, 10), v(20, 10)]),
  session("2026-10-07", [v(22.5, 10), v(22.5, 9), v(20, 10), v(20, 10)]),
  session("2026-10-14", four(22.5, 10)),
  session("2026-10-21", four(22.5, 10)),
];

describe("stall", () => {
  const e1rm = (s: ExerciseSession[]) => chartSeries("weight_reps", s, "e1rm");

  it("4 workouts on one level over 21 days, like А1", () => {
    expect(stall(e1rm(rdl))).toEqual({ since: "2026-09-30T08:00:00.000Z", count: 4, value: 30 });
    expect(stallTitle(4)).toBe("4 тренировки на одном уровне");
    expect(stallTitle(5)).toBe("5 тренировок на одном уровне");
  });

  it("not on the 3rd workout, not before 21 days, reset by a new best", () => {
    expect(stall(e1rm(rdl.slice(0, 7)))).toBeNull();
    const quick = [...rdl.slice(0, 7), session("2026-10-16", four(22.5, 10))];
    expect(stall(e1rm(quick))).toBeNull();
    const better = [...rdl, session("2026-10-28", four(22.5, 11))];
    expect(stall(e1rm(better))).toBeNull();
  });

  it("offers +1 rep, a step up with fewer reps, and the harder variant", () => {
    const since = rdl.slice(4);
    expect(stallOptions(ex("weight_reps", "barbell"), since, "Становая тяга на одной ноге")).toEqual([
      { label: "+1 повтор", value: "22,5 кг × 11" },
      { label: "+2,5 кг, меньше повторов", value: "25 кг × 8" },
      { label: "Сложнее вариант", value: "Становая тяга на одной ноге", muted: true },
    ]);
    expect(stallOptions(ex("weight_reps", "dumbbells"), [session("2026-10-01", four(10, 12))], null).map((o) => `${o.label}: ${o.value}`)).toEqual([
      "+1 повтор: 10 кг × 13",
      "+1 кг, меньше повторов: 11 кг × 10",
    ]);
    expect(stallOptions(ex("reps", "bodyweight"), [session("2026-10-01", [v(null, 20)])], null).map((o) => o.value)).toEqual(["21 раз"]);
    expect(stallOptions(ex("time", "bodyweight"), [session("2026-10-01", [v(null, null, 60)])], null).map((o) => `${o.label}: ${o.value}`)).toEqual(["+5 секунд: 1:05"]);
  });
});

describe("double progression", () => {
  const ps = (values: SetValues, i: number): PlanSet => newEntity({ plan_exercise_id: "pe", position: i, ...values });
  /** Plan `plan` × n, done with `done` (null — not done). */
  const item = (plan: SetValues, done: (SetValues | null)[], opts: { skipped?: boolean; replaced?: boolean; equipment?: Equipment } = {}) => {
    const we = { ...newWorkoutExercise("w", "e", 0), plan_exercise_id: "pe", skipped: !!opts.skipped, replaced_exercise_id: opts.replaced ? "other" : null };
    const sets = done.map((d, i) => {
      const s = newWorkoutSet(we.id, i, plan, ps(plan, i));
      return d ? { ...s, ...d, done_at: "2026-10-30T08:00:00.000Z" } : s;
    });
    return { we, exercise: ex("weight_reps", opts.equipment ?? "barbell"), replaced: null, sets };
  };
  const all = (w: number, r: number) => [v(w, r), v(w, r), v(w, r), v(w, r)];

  it("two workouts in a row at the plan → one weight step up", () => {
    expect(doubleProgression(item(v(40, 15), all(40, 15)), item(v(40, 15), all(40, 15)))).toEqual({ from: 40, to: 42.5, reps: 15 });
    expect(doubleProgression(item(v(10, 12), all(10, 12), { equipment: "dumbbells" }), item(v(10, 12), all(10, 12)))).toMatchObject({ to: 11 });
    expect(doubleProgressionWhere(15)).toBe("все подходы · 2 тренировки подряд по 15 раз — пора добавить вес");
  });

  it("not when a set is missed or short, the exercise is replaced or skipped, or there is no previous", () => {
    const prev = item(v(40, 15), all(40, 15));
    expect(doubleProgression(item(v(40, 15), [...all(40, 15).slice(0, 3), null]), prev)).toBeNull();
    expect(doubleProgression(item(v(40, 15), [...all(40, 15).slice(0, 3), v(40, 13)]), prev)).toBeNull();
    expect(doubleProgression(item(v(40, 15), all(40, 15), { replaced: true }), prev)).toBeNull();
    expect(doubleProgression(item(v(40, 15), all(40, 15)), item(v(40, 15), all(40, 15), { skipped: true }))).toBeNull();
    expect(doubleProgression(item(v(40, 15), all(40, 15)), item(v(40, 15), all(40, 15), { replaced: true }))).toBeNull();
    expect(doubleProgression(item(v(40, 15), all(40, 15)), item(v(40, 15), [...all(40, 15).slice(0, 3), v(40, 12)]))).toBeNull();
    expect(doubleProgression(item(v(40, 15), all(40, 15)), null)).toBeNull();
    expect(doubleProgression(item(v(40, 15), [v(40, 15, 40)]), prev)).toBeNull();
  });

  it("becomes one line in «Обновить веса в плане?», the heavier weight wins", () => {
    const prev = new Map([["pe", item(v(40, 15), all(40, 15))]]);
    const lines = planChanges([item(v(40, 15), all(40, 15))], { previous: prev });
    expect(lines.map((c) => `${c.where}: ${c.from} → ${c.to}`)).toEqual(["все подходы · 2 тренировки подряд по 15 раз — пора добавить вес: 40 кг → 42,5 кг"]);
    expect(lines[0].updates).toHaveLength(4);
    const heavier = planChanges([item(v(40, 15), all(45, 15))], { previous: prev });
    expect(heavier.map((c) => `${c.from} → ${c.to}`)).toEqual(["40 кг → 45 кг"]);
    expect(planChanges([item(v(40, 15), all(40, 15))])).toEqual([]);
  });
});
