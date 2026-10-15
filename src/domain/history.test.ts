import { describe, expect, it } from "vitest";
import { fieldText, formatSetDetail, groupByMonth, moodLine, parseField, type HistoryEntry } from "./history";
import type { Workout } from "./types";

const entry = (started_at: string): HistoryEntry => ({
  workout: { id: started_at, started_at } as Workout,
  planName: null,
  summary: { doneSets: 0, totalSets: 0, percent: 0, volumeKg: 0, notDone: [], replacements: [] },
});

describe("groupByMonth", () => {
  it("sorts newest first and adds the year only for other years", () => {
    const months = groupByMonth(
      [entry("2026-10-05T06:24:00.000Z"), entry("2025-12-20T06:00:00.000Z"), entry("2026-10-07T06:19:00.000Z"), entry("2026-09-29T16:40:00.000Z")],
      new Date("2026-10-15T12:00:00"),
    );
    expect(months.map((m) => [m.title, m.entries.length])).toEqual([["Октябрь", 2], ["Сентябрь", 1], ["Декабрь 2025", 1]]);
    expect(months[0].entries[0].workout.started_at).toBe("2026-10-07T06:19:00.000Z");
  });
});

describe("moodLine", () => {
  it("shows before → after with dashes for missing ratings", () => {
    expect(moodLine(3, 4)).toBe("3 → 4");
    expect(moodLine(null, 4)).toBe("— → 4");
    expect(moodLine(null, null)).toBeNull();
  });
});

describe("formatSetDetail", () => {
  it("writes units for every log type", () => {
    expect(formatSetDetail("weight_reps", { weight: 42.5, reps: 10, duration_sec: null, speed_kmh: null })).toBe("42,5 кг × 10");
    expect(formatSetDetail("bodyweight_plus", { weight: -20, reps: 10, duration_sec: null, speed_kmh: null })).toBe("−20 кг × 10");
    expect(formatSetDetail("reps", { weight: null, reps: 12, duration_sec: null, speed_kmh: null })).toBe("12 раз");
    expect(formatSetDetail("time", { weight: null, reps: null, duration_sec: 30, speed_kmh: null })).toBe("0:30");
    expect(formatSetDetail("cardio", { weight: null, reps: null, duration_sec: 900, speed_kmh: 10 })).toBe("15 мин · 10 км/ч");
  });
});

describe("edit fields", () => {
  it("round-trips values through text", () => {
    expect(parseField("weight_reps", "weight", fieldText("weight", 42.5))).toBe(42.5);
    expect(parseField("time", "duration_sec", fieldText("duration_sec", 30))).toBe(30);
    expect(parseField("cardio", "duration_sec", fieldText("duration_sec", 900))).toBe(900);
    expect(parseField("cardio", "duration_sec", "15")).toBe(900);
  });

  it("rejects typos and impossible values", () => {
    expect(parseField("weight_reps", "weight", "4o")).toBeUndefined();
    expect(parseField("weight_reps", "weight", "-5")).toBeUndefined();
    expect(parseField("bodyweight_plus", "weight", "-20")).toBe(-20);
    expect(parseField("weight_reps", "reps", "12,5")).toBeUndefined();
    expect(parseField("weight_reps", "reps", "")).toBeUndefined();
    expect(parseField("weight_reps", "weight", "")).toBeNull();
  });
});
