import { describe, expect, it } from "vitest";
import { newEntity } from "../entity";
import type { LogType, SetValues, Workout, WorkoutSet } from "../types";
import { newWorkoutSet } from "../workout";
import { monthSummary, type AnalyticsItem } from "./month-summary";

const v = (weight: number | null, reps: number | null): SetValues => ({ weight, reps, duration_sec: null, speed_kmh: null });

let n = 0;
/** A completed workout on a local date with marks, and its items. */
function workout(date: [number, number, number], marks: Partial<Pick<Workout, "mood_before" | "mood_after" | "wellbeing_before">> = {}): Workout {
  const at = new Date(date[0], date[1], date[2], 18).toISOString();
  return newEntity({
    plan_id: null, started_at: at, finished_at: at, status: "finished" as const, wellbeing_before: null, mood_before: null,
    energy_after: null, mood_after: null, note: null, plan_update_prompted: true, ...marks,
  }, { id: `w${++n}` });
}
function item(w: Workout, exerciseId: string, logType: LogType, sets: (SetValues | null)[]): AnalyticsItem {
  return {
    workoutId: w.id,
    startedAt: w.started_at,
    we: { skipped: false, replaced_exercise_id: null },
    exercise: { id: exerciseId, name: exerciseId, log_type: logType },
    sets: sets.map((s, i): WorkoutSet => ({ ...newWorkoutSet("we", i, s ?? v(20, 10)), done_at: s ? w.started_at : null })),
  };
}

describe("monthSummary", () => {
  const now = new Date(2026, 9, 31, 12);

  it("counts the month against the previous one, with month borders in local time", () => {
    const sep = workout([2026, 8, 30]);
    const oct1 = workout([2026, 9, 1]);
    const oct31 = workout([2026, 9, 31]);
    const nov = workout([2026, 10, 1]);
    const items = [
      item(sep, "rdl", "weight_reps", [v(20, 10), v(20, 10)]),
      item(oct1, "rdl", "weight_reps", [v(22.5, 10), v(22.5, 10), null]),
      item(oct31, "plank", "time", [v(null, null)]),
      item(nov, "rdl", "weight_reps", [v(30, 10)]),
    ];
    const m = monthSummary(2026, 9, [sep, oct1, oct31, nov], items, null, now);
    expect(m).toMatchObject({ workouts: 2, sets: 3, prevSets: 2, volume: 450, prevVolume: 400, rhythm: null });
    // 22,5 × 10 → ≈ 30 against 20 × 10 → ≈ 26,5.
    expect(m.growth).toEqual([{ name: "rdl", delta: 3.5 }]);
    expect(m.records).toBe(1);
    expect(m.recordExercises).toBe(1);
  });

  it("weeks in rhythm: finished weeks touching the month", () => {
    const ws = [workout([2026, 9, 5]), workout([2026, 9, 7]), workout([2026, 9, 13]), workout([2026, 9, 27])];
    const m = monthSummary(2026, 9, ws, [], 2, now);
    // 28.09–4.10, 5–11, 12–18, 19–25 finished; 26.10–1.11 still going. Only 5–11 has 2 workouts.
    expect(m.rhythm).toEqual({ full: 1, total: 4 });
  });

  it("mood from 5 workouts with both marks, wellbeing from 8 in each group", () => {
    const four = Array.from({ length: 4 }, (_, i) => workout([2026, 9, 2 + i], { mood_before: 3, mood_after: 4 }));
    expect(monthSummary(2026, 9, four, [], null, now).mood).toBeNull();
    const five = [...four, workout([2026, 9, 9], { mood_before: 2, mood_after: 5 })];
    expect(monthSummary(2026, 9, five, [], null, now).mood).toEqual({ before: 2.8, after: 4.2, count: 5 });

    const good = Array.from({ length: 8 }, (_, i) => workout([2026, 8, 1 + i], { wellbeing_before: 5 }));
    const bad = Array.from({ length: 8 }, (_, i) => workout([2026, 8, 10 + i], { wellbeing_before: 2 }));
    const items = [...good.map((w) => item(w, "x", "reps", [v(null, 10), v(null, 10)])), ...bad.map((w) => item(w, "x", "reps", [v(null, 10), null]))];
    expect(monthSummary(2026, 9, [...good, ...bad], items, null, now).feel).toEqual({ high: 100, low: 50, highCount: 8, lowCount: 8 });
    expect(monthSummary(2026, 9, [...good, ...bad.slice(1)], items, null, now).feel).toBeNull();
  });
});
