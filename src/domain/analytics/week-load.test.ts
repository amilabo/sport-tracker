import { describe, expect, it } from "vitest";
import type { MuscleGroup, WorkoutSet } from "../types";
import { newWorkoutSet } from "../workout";
import type { AnalyticsItem } from "./month-summary";
import { defaultLoadWeek, weekLoad } from "./week-load";

let n = 0;
/** `done` done sets (and `missed` not done) of an own exercise on a local date. */
function item(date: [number, number, number], group: MuscleGroup, done: number, opts: { secondary?: MuscleGroup[]; missed?: number; weight?: number } = {}): AnalyticsItem {
  const at = new Date(date[0], date[1], date[2], 18).toISOString();
  const sets: WorkoutSet[] = [
    ...Array.from({ length: done }, (_, i) => ({ ...newWorkoutSet("we", i, { weight: opts.weight ?? 10, reps: 10, duration_sec: null, speed_kmh: null }), done_at: at })),
    ...Array.from({ length: opts.missed ?? 0 }, (_, i) => newWorkoutSet("we", done + i, { weight: 10, reps: 10, duration_sec: null, speed_kmh: null })),
  ];
  return {
    workoutId: `w-${date.join("-")}`,
    startedAt: at,
    we: { skipped: false, replaced_exercise_id: null },
    exercise: { id: `e${++n}`, name: "x", log_type: "weight_reps", muscle_group: group, is_builtin: false, ...(opts.secondary ? { secondary_groups: opts.secondary } : {}) },
    sets,
  };
}

const WEEK = new Date(2026, 9, 19); // Mon 19 Oct

describe("weekLoad", () => {
  it("1 set to the main group, 0,5 to each secondary; cardio counts in sets only", () => {
    const items = [
      item([2026, 9, 19], "back", 4, { secondary: ["arms", "shoulders"], missed: 1 }),
      item([2026, 9, 21], "chest", 3, { secondary: ["arms"] }),
      item([2026, 9, 23], "cardio", 1),
      item([2026, 9, 26], "legs", 5), // next week
    ];
    const w = weekLoad(items, WEEK);
    expect(w).toMatchObject({ workouts: 3, sets: 8, volume: 800 });
    expect(w.bars.map((b) => [b.group, b.sets, b.usual])).toEqual([
      ["back", 4, null],
      ["arms", 3.5, null],
      ["chest", 3, null],
      ["shoulders", 2, null],
    ]);
  });

  it("«обычно» — the average of the previous 4 weeks since the first workout", () => {
    const items = [item([2026, 9, 5], "chest", 6), item([2026, 9, 12], "chest", 2), item([2026, 9, 19], "chest", 3)];
    // Base: 12–18 (2) and 5–11 (6); the weeks before the first workout are not averaged.
    expect(weekLoad(items, WEEK).bars).toEqual([{ group: "chest", sets: 3, usual: 4 }]);
  });

  it("a group under a third of its pair 3 weeks in a row lags", () => {
    const weeks: [number, number, number][] = [[2026, 9, 5], [2026, 9, 12], [2026, 9, 19]];
    const items = weeks.flatMap((d) => [item(d, "chest", 9), item(d, "back", 2)]);
    expect(weekLoad(items, WEEK).lag).toEqual({ group: "back", sets: 2, pair: "chest", pairSets: 9 });
    const notYet = [...items.filter((it) => !it.startedAt.startsWith(new Date(2026, 9, 5, 18).toISOString())), item([2026, 9, 5], "back", 5)];
    expect(weekLoad(notYet, WEEK).lag).toBeNull();
  });

  it("a spike: over 1,5 × the average of 4 full previous weeks", () => {
    const base = [[2026, 8, 21], [2026, 8, 28], [2026, 9, 5], [2026, 9, 12]].map((d) => item(d as [number, number, number], "legs", 10));
    expect(weekLoad([...base, item([2026, 9, 19], "legs", 16)], WEEK).spike).toEqual({ sets: 16, usual: 10, ratio: 1.6 });
    expect(weekLoad([...base, item([2026, 9, 19], "legs", 15)], WEEK).spike).toBeNull();
    // Only 3 weeks of history: no spike yet.
    expect(weekLoad([...base.slice(1), item([2026, 9, 19], "legs", 30)], WEEK).spike).toBeNull();
  });

  it("the week shown first: the current one with a workout, otherwise the previous one", () => {
    const items = [item([2026, 9, 21], "chest", 3)];
    expect(defaultLoadWeek(items, WEEK)).toEqual(WEEK);
    expect(defaultLoadWeek(items, new Date(2026, 9, 26))).toEqual(WEEK);
  });
});
