import { describe, expect, it } from "vitest";
import { newEntity } from "./entity";
import { planChanges } from "./plan-diff";
import { durationMinutes, formatDuration, formatDurationLong, formatKg, summarize } from "./summary";
import type { Exercise, LogType, PlanSet, SetValues, WorkoutExercise, WorkoutSet } from "./types";
import { newWorkoutExercise, newWorkoutSet } from "./workout";

const ex = (name: string, log_type: LogType): Exercise =>
  newEntity({ name, muscle_group: "arms" as const, equipment: "cable" as const, log_type, is_builtin: true, archived_at: null, progression_id: null, progression_level: null });
const v = (weight: number | null, reps: number | null, duration_sec: number | null = null): SetValues => ({ weight, reps, duration_sec, speed_kmh: null });
const ps = (values: SetValues, position = 0): PlanSet => newEntity({ plan_exercise_id: "pe", position, ...values });

/** Planned sets `plan`, actually done with `done` values (null = not done). */
function item(exercise: Exercise, plan: SetValues[], done: (SetValues | null)[], opts: { skipped?: boolean; replaced?: Exercise; extra?: SetValues[] } = {}) {
  const we: WorkoutExercise = { ...newWorkoutExercise("w", exercise.id, 0), skipped: !!opts.skipped };
  const sets: WorkoutSet[] = plan.map((p, i) => {
    const s = newWorkoutSet(we.id, i, p, ps(p, i));
    const d = done[i];
    return d ? { ...s, ...d, done_at: "2026-10-15T07:00:00.000Z" } : s;
  });
  (opts.extra ?? []).forEach((x, i) => sets.push({ ...newWorkoutSet(we.id, plan.length + i, x), done_at: "2026-10-15T07:00:00.000Z" }));
  return { we, exercise, replaced: opts.replaced ?? null, sets };
}

const curl = ex("Сгибание рук на нижнем блоке", "weight_reps");
const raise = ex("Махи гантелями в стороны сидя", "weight_reps");
const rdl = ex("Румынская тяга", "weight_reps");
const plank = ex("Планка на предплечьях", "time");
const pullups = ex("Подтягивания", "bodyweight_plus");
const gravitron = ex("Гравитрон", "bodyweight_plus");

describe("planChanges", () => {
  it("groups consecutive sets with the same change, like the mockup", () => {
    const changes = planChanges([
      item(curl, [v(15, 10), v(15, 10), v(15, 10), v(15, 10)], [v(15, 10), v(17.5, 10), v(17.5, 10), v(15, 10)]),
      item(raise, [v(3, 12), v(3, 12), v(3, 12), v(3, 12)], [v(4, 12), v(4, 12), v(4, 12), v(4, 12)]),
      item(rdl, [v(20, 12), v(20, 12), v(20, 12), v(20, 12)], [v(20, 12), v(20, 12), v(20, 12), v(20, 10)]),
    ]);
    expect(changes.map((c) => `${c.exerciseName}: ${c.where}: ${c.from} → ${c.to}`)).toEqual([
      "Сгибание рук на нижнем блоке: подходы 2–3: 15 кг → 17,5 кг",
      "Махи гантелями в стороны сидя: все 4 подхода: 3 кг → 4 кг",
      "Румынская тяга: подход 4: 12 раз → 10 раз",
    ]);
    expect(changes[0].updates.map((u) => [u.field, u.value])).toEqual([["weight", 17.5], ["weight", 17.5]]);
  });

  it("ignores undone sets, added sets, skipped and replaced exercises", () => {
    expect(planChanges([item(curl, [v(15, 10)], [null])])).toEqual([]);
    expect(planChanges([item(curl, [v(15, 10)], [v(15, 10)], { extra: [v(20, 8)] })])).toEqual([]);
    expect(planChanges([item(curl, [v(15, 10)], [v(20, 10)], { skipped: true })])).toEqual([]);
    expect(planChanges([item(curl, [v(15, 10)], [v(20, 10)], { replaced: raise })])).toEqual([]);
  });

  it("fills an empty planned weight and formats time and assistance", () => {
    const lunges = planChanges([item(rdl, [v(null, 20), v(null, 20)], [v(6, 20), v(6, 20)])]);
    expect(lunges.map((c) => `${c.where}: ${c.from} → ${c.to}`)).toEqual(["все 2 подхода: — → 6 кг"]);
    const t = planChanges([item(plank, [v(null, null, 30)], [v(null, null, 45)])]);
    expect(`${t[0].from} → ${t[0].to}`).toBe("0:30 → 0:45");
    const g = planChanges([item(gravitron, [v(-30, 10)], [v(-25, 10)])]);
    expect(`${g[0].from} → ${g[0].to}`).toBe("−30 кг → −25 кг");
  });
});

describe("summarize", () => {
  it("percent of done sets, volume of done weight sets, not-done list", () => {
    const s = summarize([
      item(curl, [v(15, 10), v(15, 10)], [v(15, 10), v(17.5, 10)]),
      item(plank, [v(null, null, 30), v(null, null, 30), v(null, null, 30)], [v(null, null, 30), null, null]),
      item(pullups, [v(10, 8), v(0, 8)], [v(10, 8), v(0, 8)]),
      item(gravitron, [v(-20, 10)], [v(-20, 10)]),
      item(raise, [v(3, 12)], [null], { skipped: true }),
      item(rdl, [v(20, 12)], [v(20, 12)], { replaced: curl }),
    ]);
    expect(s.doneSets).toBe(7);
    expect(s.totalSets).toBe(10);
    expect(s.percent).toBe(70);
    // 150 + 175 (curl) + 80 (pull-ups +10 kg) + 240 (rdl); assistance and bodyweight count 0.
    expect(s.volumeKg).toBe(645);
    expect(s.notDone).toEqual(["Планка на предплечьях — подходы 2, 3", "Махи гантелями в стороны сидя — пропущено"]);
    expect(s.replacements).toEqual(["Румынская тяга вместо «Сгибание рук на нижнем блоке»"]);
  });

  it("formats duration and volume", () => {
    expect(durationMinutes("2026-10-15T06:24:00.000Z", "2026-10-15T07:26:30.000Z")).toBe(63);
    expect(formatDuration(62)).toBe("1:02");
    expect(formatDurationLong(62)).toBe("1 ч 02 мин");
    expect(formatDurationLong(58)).toBe("58 мин");
    expect(formatKg(4980)).toBe("4 980");
  });
});
