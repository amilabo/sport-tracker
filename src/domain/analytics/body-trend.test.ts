import { describe, expect, it } from "vitest";
import { newEntity } from "../entity";
import type { SetValues, Workout, WorkoutSet } from "../types";
import { newWorkoutSet } from "../workout";
import { trainingInPeriod, trendRate, weightTrend } from "./body-trend";
import type { AnalyticsItem } from "./month-summary";

describe("weightTrend", () => {
  it("follows a steady change and damps a one-day swing", () => {
    const flat = weightTrend([
      { date: "2026-10-01", value: 64 },
      { date: "2026-10-02", value: 66 },
      { date: "2026-10-03", value: 64 },
    ]);
    // α for 1 day = 1 − e^(−0,1) ≈ 0,095: +2 kg for a day moves the trend by ≈ 0,19.
    expect(flat[1].value).toBeCloseTo(64.19, 2);
    expect(flat[2].value).toBeLessThan(64.2);
    expect(weightTrend([]).length).toBe(0);
  });

  it("the rate per week over the last 6 weeks; too little data — none", () => {
    const weekly = Array.from({ length: 9 }, (_, i) => {
      const d = new Date(2026, 7, 31 + i * 7);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, value: 65 - 0.2 * i };
    });
    const rate = trendRate(weightTrend(weekly))!;
    expect(rate.weeks).toBe(6);
    expect(rate.perWeek).toBeLessThan(0);
    expect(rate.perWeek).toBeGreaterThan(-0.2);
    expect(trendRate(weightTrend(weekly.slice(0, 2)))).toBeNull();
    expect(trendRate(weightTrend([{ date: "2026-10-01", value: 64 }, { date: "2026-10-05", value: 64 }, { date: "2026-10-10", value: 63 }]))).toBeNull();
  });
});

describe("trainingInPeriod", () => {
  const v = (weight: number, reps: number): SetValues => ({ weight, reps, duration_sec: null, speed_kmh: null });
  const w = (date: string): Workout =>
    newEntity({ plan_id: null, started_at: `${date}T15:00:00.000Z`, finished_at: null, status: "finished" as const, wellbeing_before: null, mood_before: null, energy_after: null, mood_after: null, note: null, plan_update_prompted: true }, { id: date });
  const item = (date: string, id: string, values: SetValues[]): AnalyticsItem => ({
    workoutId: date,
    startedAt: `${date}T15:00:00.000Z`,
    we: { skipped: false, replaced_exercise_id: null },
    exercise: { id, name: id, log_type: "weight_reps", muscle_group: "legs", is_builtin: false },
    sets: values.map((x, i): WorkoutSet => ({ ...newWorkoutSet("we", i, x), done_at: "x" })),
  });

  it("workouts, per week, sets and ≈ max of the most frequent exercises, first → last", () => {
    const ws = [w("2026-09-01"), w("2026-09-15"), w("2026-10-01"), w("2026-11-01")];
    const items = [
      item("2026-09-01", "rdl", [v(17.5, 12), v(17.5, 12)]),
      item("2026-09-15", "rdl", [v(20, 12)]),
      item("2026-10-01", "rdl", [v(22.5, 10)]),
      item("2026-10-01", "row", [v(30, 10)]),
      item("2026-11-01", "rdl", [v(40, 10)]),
    ];
    const t = trainingInPeriod(ws, items, "2026-09-01", "2026-10-01")!;
    expect(t.workouts).toBe(3);
    expect(t.sets).toBe(5);
    expect(t.perWeek).toBeCloseTo(3 / (31 / 7), 5);
    // The row has one workout: no «first → last».
    expect(t.strength).toEqual([{ name: "rdl", from: 24.5, to: 30 }]);
    expect(trainingInPeriod(ws, items, "2026-08-01", "2026-08-20")).toBeNull();
  });
});
