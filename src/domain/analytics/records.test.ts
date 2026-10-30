import { describe, expect, it } from "vitest";
import { chartSeries, type ExerciseSession } from "../chart-series";
import { newWorkoutSet } from "../workout";
import type { LogType, SetValues, WorkoutSet } from "../types";
import { bestE1rm, e1rm, isTimedSet, roundE1rm } from "./e1rm";
import { exerciseRecords, usualWeight, workoutRecords, type RecordItem } from "./records";

const v = (weight: number | null, reps: number | null, duration_sec: number | null = null): SetValues => ({ weight, reps, duration_sec, speed_kmh: null });
const done = (values: SetValues[]): WorkoutSet[] => values.map((x, i) => ({ ...newWorkoutSet("we", i, x), done_at: "2026-10-01T08:00:00.000Z" }));
const session = (date: string, values: SetValues[]): ExerciseSession => ({ workoutId: `w-${date}`, startedAt: `${date}T08:00:00.000Z`, sets: done(values) });
const four = (w: number, r: number) => [v(w, r), v(w, r), v(w, r), v(w, r)];

// Mockup А1: Romanian deadlift, 02.09 → 30.09 growing, then 4 workouts at 22,5 × 10.
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

describe("e1rm", () => {
  it("is Epley up to 12 reps, the weight itself at 1 rep", () => {
    expect(e1rm(22.5, 10)).toBe(30);
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(20, 12)).toBeCloseTo(28);
    expect(e1rm(20, 13)).toBeNull();
    expect(e1rm(20, 0)).toBeNull();
    expect(e1rm(null, 10)).toBeNull();
    expect(e1rm(0, 10)).toBeNull();
    expect(roundE1rm(23.33)).toBe(23.5);
  });

  it("takes the best untimed done set", () => {
    const sets = done([v(20, 12), v(22.5, 10), v(30, 15)]);
    expect(bestE1rm(sets)).toMatchObject({ value: 30, set: { weight: 22.5, reps: 10 } });
    expect(bestE1rm(done([v(16, 15, 40)]))).toBeNull();
    expect(isTimedSet({ duration_sec: 40 })).toBe(true);
    expect(isTimedSet({ duration_sec: null })).toBe(false);
  });

  it("charts ≈ максимум per workout, by hand for the RDL", () => {
    const pts = chartSeries("weight_reps", rdl, "e1rm");
    // 17,5 × 1,4 = 24,5; 20 × 1,333 = 26,67 → 26,5; 20 × 1,4 = 28; 22,5 × 1,267 = 28,5; 22,5 × 1,333 = 30.
    expect(pts.map((p) => p.value)).toEqual([24.5, 26.5, 28, 28.5, 30, 30, 30, 30]);
    expect(pts.at(-1)!.label).toBe("22,5×10");
    expect(chartSeries("weight_reps", [session("2026-10-01", four(40, 15))], "e1rm")).toEqual([]);
    expect(chartSeries("weight_reps", rdl).at(-1)!.value).toBe(22.5);
  });
});

describe("exerciseRecords", () => {
  it("matches mockup А1", () => {
    const recs = exerciseRecords("weight_reps", rdl);
    expect(recs.map((r) => `${r.title}: ${r.value} · ${r.date.slice(5, 10)}${r.note ? ` · ${r.note}` : ""}`)).toEqual([
      "Расчётный максимум: ≈ 30 кг · 09-30",
      "Лучший вес: 22,5 кг × 10 · 09-30",
      "Объём за тренировку: 900 кг · 10-14 · 4 × 10 × 22,5",
      "Больше всего раз с 20 кг: 12 раз · 09-16",
    ]);
  });

  it("needs two workouts; cardio has none", () => {
    expect(exerciseRecords("weight_reps", rdl.slice(0, 1))).toEqual([]);
    expect(exerciseRecords("cardio", [session("2026-10-01", [v(null, null, 900)]), session("2026-10-02", [v(null, null, 900)])])).toEqual([]);
  });

  it("own weight: reps until there is an added weight", () => {
    const hyper = [session("2026-10-01", [v(null, 15)]), session("2026-10-08", [v(null, 18), v(null, 15)])];
    expect(exerciseRecords("bodyweight_plus", hyper).map((r) => `${r.title}: ${r.value}`)).toEqual(["Больше всего раз: 18 раз"]);
    const pull = [...hyper, session("2026-10-15", [v(5, 8)])];
    expect(exerciseRecords("bodyweight_plus", pull).map((r) => `${r.title}: ${r.value}`)).toEqual(["Лучший добавленный вес: +5 кг × 8"]);
  });

  it("reps and time", () => {
    const reps = [session("2026-10-01", [v(null, 20), v(null, 20)]), session("2026-10-08", [v(null, 25), v(null, 10)])];
    expect(exerciseRecords("reps", reps).map((r) => `${r.title}: ${r.value}`)).toEqual(["Больше всего раз за подход: 25 раз", "Больше всего раз за тренировку: 40 раз"]);
    const plank = [session("2026-10-01", [v(null, null, 60)]), session("2026-10-08", [v(null, null, 75)])];
    expect(exerciseRecords("time", plank).map((r) => `${r.title}: ${r.value}`)).toEqual(["Самый долгий подход: 1:15"]);
  });

  it("timed sets give no weight records", () => {
    const sessions = [session("2026-10-01", four(20, 10)), session("2026-10-08", [v(40, 15, 40)])];
    expect(exerciseRecords("weight_reps", sessions).find((r) => r.title === "Лучший вес")?.value).toBe("20 кг × 10");
  });

  it("usual weight: the most frequent of the latest five but the best, heavier on a tie", () => {
    expect(usualWeight(rdl)).toBe(22.5);
    expect(usualWeight(rdl, 22.5)).toBe(20);
    expect(usualWeight([session("2026-10-01", [v(20, 10), v(25, 8)])])).toBe(25);
  });
});

describe("workoutRecords", () => {
  const item = (exerciseId: string, logType: LogType, values: SetValues[]): RecordItem => ({ exerciseId, name: exerciseId, logType, sets: done(values) });
  const history = new Map([["rdl", rdl]]);

  it("one line per exercise: best weight first, then ≈ max, then volume", () => {
    const line = (values: SetValues[]) => workoutRecords([item("rdl", "weight_reps", values)], history).map((r) => `${r.kind}: ${r.value} (${r.delta})`);
    expect(line([v(25, 8), v(22.5, 10)])).toEqual(["лучший вес: 25 кг × 8 (+2,5 кг)"]);
    expect(line([v(22.5, 12)])).toEqual(["расчётный максимум: ≈ 31,5 кг (+1,5 кг)"]);
    expect(line([v(22.5, 10), v(22.5, 10), v(22.5, 10), v(22.5, 10), v(20, 5)])).toEqual(["объём за тренировку: 1 000 кг (+100 кг)"]);
    expect(line(four(22.5, 10))).toEqual([]);
  });

  it("first time is not a record; timed sets are not either", () => {
    expect(workoutRecords([item("new", "weight_reps", four(50, 5))], history)).toEqual([]);
    expect(workoutRecords([item("rdl", "weight_reps", [v(40, 15, 40)])], history)).toEqual([]);
  });

  it("own weight and reps", () => {
    const h = new Map([["hyper", [session("2026-10-01", [v(null, 15)])]]]);
    expect(workoutRecords([item("hyper", "bodyweight_plus", [v(null, 18)])], h).map((r) => `${r.kind}: ${r.value} (${r.delta})`)).toEqual(["больше всего раз: 18 раз (+3)"]);
    expect(workoutRecords([item("hyper", "bodyweight_plus", [v(5, 10)])], h).map((r) => `${r.kind}: ${r.value} (${r.delta})`)).toEqual(["лучший вес: +5 кг × 10 (+5 кг)"]);
  });

  it("an exercise twice in a workout counts once", () => {
    const recs = workoutRecords([item("rdl", "weight_reps", [v(25, 8)]), item("rdl", "weight_reps", [v(27.5, 5)])], history);
    expect(recs.map((r) => r.value)).toEqual(["27,5 кг × 5"]);
  });
});
