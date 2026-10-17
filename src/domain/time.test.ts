import { describe, expect, it } from "vitest";
import { isWorkoutDate, parseTime24, workoutMoments } from "./time";

describe("workout date and time", () => {
  it("parses 24-hour time", () => {
    expect(parseTime24("09:05")).toEqual({ h: 9, m: 5 });
    expect(parseTime24("24:00")).toBeNull();
    expect(parseTime24("9")).toBeNull();
  });

  it("a workout date is not in the future", () => {
    expect(isWorkoutDate("2026-10-16", "2026-10-17")).toBe(true);
    expect(isWorkoutDate("2026-10-17", "2026-10-17")).toBe(true);
    expect(isWorkoutDate("2026-10-18", "2026-10-17")).toBe(false);
    expect(isWorkoutDate("", "2026-10-17")).toBe(false);
  });

  it("start and end on the chosen date; an end before the start is the next day", () => {
    const { start, end } = workoutMoments("2026-10-10", "18:30", "20:00");
    expect(start).toEqual(new Date(2026, 9, 10, 18, 30));
    expect(end).toEqual(new Date(2026, 9, 10, 20, 0));
    expect(workoutMoments("2026-10-10", "23:30", "00:40").end).toEqual(new Date(2026, 9, 11, 0, 40));
    expect(workoutMoments("2026-10-10", "18:30", "2").end).toBeNull();
    expect(workoutMoments("", "18:30", "20:00").start).toBeNull();
  });
});
