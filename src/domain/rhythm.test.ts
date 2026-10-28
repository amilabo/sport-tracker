import { describe, expect, it } from "vitest";
import { currentWeek, dayKey, doneByDay, goalWord, habitDays, monthGrid, recentWeeks, weekStart, weeksInRhythm } from "./rhythm";
import type { Workout } from "./types";

// Local times: the week and the day are the phone's, not UTC.
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();
const w = (started: string, status: Workout["status"] = "finished") => ({ started_at: started, status });
const NOW = new Date(2026, 9, 28, 12); // Wed 28 Oct 2026

describe("weeks and days", () => {
  it("a week starts on Monday in local time", () => {
    expect(dayKey(weekStart(NOW))).toBe("2026-10-26");
    expect(dayKey(weekStart(new Date(2026, 10, 1, 23)))).toBe("2026-10-26");
    expect(dayKey(weekStart(new Date(2026, 10, 2, 0, 5)))).toBe("2026-11-02");
  });

  it("only completed workouts count; two on one day count twice", () => {
    const done = doneByDay([w(at(2026, 10, 26)), w(at(2026, 10, 26, 18), "auto_finished"), w(at(2026, 10, 27), "in_progress")]);
    expect([...done]).toEqual([["2026-10-26", 2]]);
  });
});

describe("currentWeek", () => {
  it("seven days with done, today and missed days; the count of workouts", () => {
    const { days, count } = currentWeek(doneByDay([w(at(2026, 10, 26)), w(at(2026, 10, 19))]), NOW);
    expect(days.map((d) => d.letter).join("")).toBe("ПВСЧПСВ");
    expect(days.map((d) => (d.done ? "✓" : d.today ? "○" : d.past ? "·" : "_")).join("")).toBe("✓·○____");
    expect(count).toBe(1);
  });
});

describe("recentWeeks", () => {
  const done = doneByDay([w(at(2026, 10, 26)), w(at(2026, 10, 21)), w(at(2026, 10, 23)), w(at(2026, 10, 13))]);
  const weeks = recentWeeks(done, NOW, 4);

  it("the current week first, with ranges across months and the days with workouts", () => {
    expect(weeks.map((x) => [x.range, x.days, x.count])).toEqual([
      ["26 окт – 1 ноя", "пн · идёт неделя", 1],
      ["19–25 окт", "ср, пт", 2],
      ["12–18 окт", "вт", 1],
      ["5–11 окт", "не было", 0],
    ]);
  });

  it("weeks in rhythm do not count the current one", () => {
    expect(weeksInRhythm(weeks, 2)).toEqual({ full: 1, total: 3 });
    expect(weeksInRhythm(weeks, 1)).toEqual({ full: 2, total: 3 });
  });
});

describe("monthGrid", () => {
  it("October 2026 starts on Thursday: three empty cells, 31 days, done and future days", () => {
    const { cells, count } = monthGrid(2026, 9, doneByDay([w(at(2026, 10, 1)), w(at(2026, 10, 26)), w(at(2026, 9, 30))]), NOW);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells.length).toBe(34);
    expect(cells[3]).toMatchObject({ day: 1, done: true, future: false });
    expect(cells.find((c) => c?.day === 28)).toMatchObject({ today: true, future: false });
    expect(cells.find((c) => c?.day === 29)).toMatchObject({ future: true });
    expect(count).toBe(2);
  });
});

describe("habitDays", () => {
  it("counts by weekday over 8 weeks; days with at least ¾ of the top are habitual", () => {
    const list = [];
    for (let k = 0; k < 8; k++) list.push(w(at(2026, 9, 8 + 7 * k)), w(at(2026, 9, 10 + 7 * k)));
    list.pop(); // one Thursday missed: 8 Tuesdays, 7 Thursdays
    list.push(w(at(2026, 10, 5)));
    const habit = habitDays(doneByDay(list), NOW);
    expect(habit.map((h) => `${h.name}${h.count}${h.top ? "*" : ""}`).join(" ")).toBe("пн1 вт8* ср0 чт7* пт0 сб0 вс0");
  });

  it("older than 8 weeks is not counted; nothing — no habitual days", () => {
    expect(habitDays(doneByDay([w(at(2026, 8, 1))]), NOW).some((h) => h.count || h.top)).toBe(false);
  });
});

describe("goalWord", () => {
  it("раз / раза", () => {
    expect([1, 2, 3, 4, 5, 6].map(goalWord)).toEqual(["раз", "раза", "раза", "раза", "раз", "раз"]);
  });
});
