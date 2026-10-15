import { describe, expect, it } from "vitest";
import { bestResult, chartSeries, formatDelta, formatValue, inPeriod, type ExerciseSession } from "./chart-series";
import type { WorkoutSet } from "./types";

const set = (v: Partial<WorkoutSet>, done = true): WorkoutSet =>
  ({ weight: null, reps: null, duration_sec: null, speed_kmh: null, done_at: done ? "2026-10-01T10:00:00.000Z" : null, ...v }) as WorkoutSet;
const session = (date: string, sets: WorkoutSet[]): ExerciseSession => ({ workoutId: date, startedAt: `${date}T07:00:00.000Z`, sets });

describe("chartSeries by log type", () => {
  it("weight_reps: heaviest done set, reps of that weight as the label; undone sets ignored", () => {
    const pts = chartSeries("weight_reps", [
      session("2026-10-07", [set({ weight: 15, reps: 15 }), set({ weight: 17.5, reps: 12 }), set({ weight: 17.5, reps: 10 }), set({ weight: 30, reps: 5 }, false)]),
      session("2026-10-05", [set({ weight: 15, reps: 15 })]),
    ]);
    expect(pts.map((p) => [p.date.slice(0, 10), p.value, p.label])).toEqual([["2026-10-05", 15, "×15"], ["2026-10-07", 17.5, "×12"]]);
  });

  it("bodyweight_plus: assistance is negative, no weight counts as 0", () => {
    const pts = chartSeries("bodyweight_plus", [
      session("2026-09-01", [set({ weight: -20, reps: 10 })]),
      session("2026-10-01", [set({ weight: null, reps: 8 })]),
    ]);
    expect(pts.map((p) => p.value)).toEqual([-20, 0]);
    expect(formatValue("bodyweight_plus", -20)).toBe("−20 кг");
    expect(formatValue("bodyweight_plus", 0)).toBe("свой вес");
  });

  it("reps: most reps; time: the longest set; cardio: total duration", () => {
    expect(chartSeries("reps", [session("2026-10-01", [set({ reps: 12 }), set({ reps: 14 })])])[0].value).toBe(14);
    expect(chartSeries("time", [session("2026-10-01", [set({ duration_sec: 30 }), set({ duration_sec: 45 })])])[0].value).toBe(45);
    expect(chartSeries("cardio", [session("2026-10-01", [set({ duration_sec: 600 }), set({ duration_sec: 300 })])])[0].value).toBe(900);
  });

  it("a workout with nothing done gives no point", () => {
    expect(chartSeries("reps", [session("2026-10-01", [set({ reps: 12 }, false)])])).toEqual([]);
  });
});

describe("period, delta and best", () => {
  const pts = chartSeries("weight_reps", [
    session("2026-06-01", [set({ weight: 10, reps: 12 })]),
    session("2026-09-01", [set({ weight: 12.5, reps: 12 })]),
    session("2026-10-10", [set({ weight: 15, reps: 10 })]),
  ]);

  it("filters by calendar months back from now", () => {
    const now = new Date("2026-10-15T12:00:00");
    expect(inPeriod(pts, "1m", now)).toHaveLength(1);
    expect(inPeriod(pts, "3m", now)).toHaveLength(2);
    expect(inPeriod(pts, "all", now)).toHaveLength(3);
  });

  it("delta between the first and the last point of the period", () => {
    expect(formatDelta("weight_reps", pts)).toBe("+5 кг");
    expect(formatDelta("weight_reps", pts.slice(0, 1))).toBeNull();
    expect(formatDelta("time", chartSeries("time", [session("2026-10-01", [set({ duration_sec: 45 })]), session("2026-10-02", [set({ duration_sec: 30 })])]))).toBe("−0:15");
  });

  it("best result of all time with its reps", () => {
    expect(bestResult("weight_reps", pts)).toEqual({ title: "Лучший вес", value: "15 кг", note: "×10" });
    expect(bestResult("reps", [])).toBeNull();
    const reps = chartSeries("reps", [session("2026-10-01", [set({ reps: 10 })]), session("2026-10-02", [set({ reps: 12 })])]);
    expect([formatDelta("reps", reps), formatValue("reps", 22)]).toEqual(["+2 раза", "22 раза"]);
  });
});
