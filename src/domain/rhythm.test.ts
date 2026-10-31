import { describe, expect, it } from "vitest";
import { currentWeek, dayKey, doneByDay, goalWord, habitDays, monthGrid, monthWeeks, recentWeeks, shortDuration, weekStart, weeksInRhythm, weekWorkouts } from "./rhythm";
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

describe("monthWeeks (А3)", () => {
  const done = doneByDay([w(at(2026, 9, 28)), w(at(2026, 10, 2)), w(at(2026, 10, 19)), w(at(2026, 10, 21))]);

  it("weeks touching the month, newest first; the current one is going, future ones are absent", () => {
    const weeks = monthWeeks(2026, 9, done, new Date(2026, 9, 30, 12));
    expect(weeks.map((x) => x.range)).toEqual(["26 окт – 1 ноя", "19–25 окт", "12–18 окт", "5–11 окт", "28 сен – 4 окт"]);
    expect(weeks[0]).toMatchObject({ current: true, days: "идёт неделя", count: 0 });
    expect(weeks.at(-1)).toMatchObject({ days: "пн, пт", count: 2 });
    expect(weeksInRhythm(weeks, 2)).toEqual({ full: 2, total: 4 });
    // Mid-month: only the weeks so far.
    expect(monthWeeks(2026, 9, done, new Date(2026, 9, 8, 12)).map((x) => x.range)).toEqual(["5–11 окт", "28 сен – 4 окт"]);
  });

  it("a week across the year border is in both months", () => {
    const dec = monthWeeks(2026, 11, new Map(), new Date(2027, 0, 20));
    const jan = monthWeeks(2027, 0, new Map(), new Date(2027, 0, 20));
    expect(dec[0].range).toBe("28 дек – 3 янв");
    expect(jan.at(-1)!.range).toBe("28 дек – 3 янв");
  });
});

describe("weekWorkouts", () => {
  const entry = (id: string, start: string, minutes: number | null, plan: string | null, sets: number, kg: number) => ({
    workout: { id, started_at: start, finished_at: minutes === null ? null : new Date(new Date(start).getTime() + minutes * 60000).toISOString() },
    planName: plan,
    summary: { doneSets: sets, volumeKg: kg },
  });

  it("the week's workouts oldest first, the other month's days included, and the total", () => {
    const entries = [
      entry("b", at(2026, 10, 2, 18), 64, "Ягодицы / спина", 20, 2400),
      entry("a", at(2026, 9, 28, 18), 58, "Ноги / грудь / руки", 18, 2000),
      entry("c", at(2026, 10, 5, 18), 50, null, 10, 0),
    ];
    const week = weekWorkouts("2026-09-28", entries);
    expect(week.items).toEqual([
      { id: "a", day: "пн 28.09", plan: "Ноги / грудь / руки", duration: "58 мин" },
      { id: "b", day: "пт 02.10", plan: "Ягодицы / спина", duration: "1:04" },
    ]);
    expect([week.sets, week.volume]).toEqual([38, 4400]);
    expect(weekWorkouts("2026-10-05", entries).items[0].plan).toBe("Без плана");
    expect(weekWorkouts("2026-10-12", entries)).toEqual({ items: [], sets: 0, volume: 0 });
    expect(shortDuration(60)).toBe("1:00");
  });
});
