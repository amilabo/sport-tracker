import { describe, expect, it } from "vitest";
import { planQueue, planReminders, REMINDERS_DEFAULT, weekTitleRange, type ReminderSettings } from "./reminders";
import type { Plan, Workout } from "./types";

const plan = (id: string, name: string) => ({ id, name }) as Plan;
const A = plan("a", "Ноги / грудь / руки");
const B = plan("b", "Ягодицы / спина");
const done = (iso: string, plan_id: string | null): Pick<Workout, "started_at" | "status" | "plan_id"> => ({ started_at: iso, status: "finished", plan_id });
// Sunday 1 November 2026, local time; last week: A on Tuesday, B on Thursday.
const NOW = new Date(2026, 10, 1, 10, 0);
const WORKOUTS = [done(new Date(2026, 9, 27, 19).toISOString(), "a"), done(new Date(2026, 9, 29, 19).toISOString(), "b")];
const ALL_ON: ReminderSettings = {
  days: [1, 3],
  weekly: { on: true, day: 6, time: "20:00" },
  tomorrow: { on: true, time: "20:00" },
  goal: { on: true, time: "18:00" },
};

function plan4(settings: ReminderSettings, opts: { now?: Date; workouts?: typeof WORKOUTS; goal?: number | null } = {}) {
  return planReminders({
    plans: [A, B],
    exerciseCounts: new Map([["a", 10], ["b", 8]]),
    workouts: opts.workouts ?? WORKOUTS,
    goal: opts.goal === undefined ? 2 : opts.goal,
    settings,
    now: opts.now ?? NOW,
  });
}
const local = (ms: number) => {
  const d = new Date(ms);
  return `${["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()]} ${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

describe("planReminders", () => {
  it("all three off by default — nothing", () => {
    expect(plan4(REMINDERS_DEFAULT)).toEqual([]);
  });

  it("the week of mockup Н3: plan on Sunday, «Завтра» before Tue and Thu, the goal on Friday (Thursday had «Завтра»)", () => {
    const week = plan4(ALL_ON).filter((r) => r.at < new Date(2026, 10, 9).getTime());
    expect(week.map((r) => `${local(r.at)} ${r.kind}`)).toEqual([
      "вс 1.11 20:00 weekly",
      "пн 2.11 20:00 tomorrow",
      "ср 4.11 20:00 tomorrow",
      "пт 6.11 18:00 goal",
      "сб 7.11 18:00 goal",
      "вс 8.11 20:00 weekly",
    ]);
    expect(week[0]).toMatchObject({ title: "Неделя 2–8 ноября: 2 тренировки", text: "Вт — Ноги / грудь / руки\nЧт — Ягодицы / спина" });
    expect(week[1]).toMatchObject({ title: "Завтра тренировка", text: "Ноги / грудь / руки · 10 упражнений" });
    expect(week[3]).toMatchObject({ title: "Неделя ещё может сложиться", text: "Пока 0 из 2, до конца недели 3 дня. Следующая — Ноги / грудь / руки" });
  });

  it("the goal reached this week — no «Завтра» and no «Цель недели» till Monday", () => {
    // Wednesday 4 Nov: A on Mon, B on Tue — 2 of 2.
    const now = new Date(2026, 10, 4, 9);
    const workouts = [...WORKOUTS, done(new Date(2026, 10, 2, 19).toISOString(), "a"), done(new Date(2026, 10, 3, 19).toISOString(), "b")];
    const week = plan4(ALL_ON, { now, workouts }).filter((r) => r.at < new Date(2026, 10, 9).getTime());
    expect(week.map((r) => r.kind)).toEqual(["weekly"]);
  });

  it("the last day of the week: one missing — «Последний день недели»; two missing — silence", () => {
    const sunday = new Date(2026, 10, 8, 9);
    const one = plan4({ ...ALL_ON, days: [], tomorrow: { ...ALL_ON.tomorrow, on: false } }, { now: sunday, workouts: [...WORKOUTS, done(new Date(2026, 10, 3, 19).toISOString(), "a")] });
    expect(one[0]).toMatchObject({ kind: "goal", title: "Последний день недели", text: "Одна тренировка — и будет 2 из 2" });
    expect(local(one[0].at)).toBe("вс 8.11 18:00");
    const two = plan4({ ...ALL_ON, days: [] }, { now: sunday });
    expect(two.filter((r) => r.at < new Date(2026, 10, 9).getTime())).toEqual([]);
  });

  it("goal 3: the first «Цель недели» on Tuesday; without days only the goal comes", () => {
    const monday = new Date(2026, 10, 2, 9);
    const out = plan4({ ...ALL_ON, days: [] }, { now: monday, goal: 3 }).filter((r) => r.at < new Date(2026, 10, 9).getTime());
    expect(out.map((r) => `${local(r.at)} ${r.kind}`)).toEqual(["вт 3.11 18:00 goal", "ср 4.11 18:00 goal", "чт 5.11 18:00 goal", "пт 6.11 18:00 goal"]);
  });

  it("no goal — «Цель недели» never comes, «Завтра» always does", () => {
    const out = plan4(ALL_ON, { goal: null });
    expect(out.some((r) => r.kind === "goal")).toBe(false);
    expect(out.filter((r) => r.kind === "tomorrow")).toHaveLength(8);
  });

  it("a Monday «План на неделю» is about this week; times already gone are skipped", () => {
    const out = plan4({ ...ALL_ON, weekly: { on: true, day: 0, time: "08:00" } }, { now: new Date(2026, 10, 2, 7) });
    expect(out[0]).toMatchObject({ kind: "weekly", title: "Неделя 2–8 ноября: 2 тренировки" });
    const later = plan4({ ...ALL_ON, weekly: { on: true, day: 0, time: "08:00" } }, { now: new Date(2026, 10, 2, 9) });
    expect(local(later.find((r) => r.kind === "weekly")!.at)).toBe("пн 9.11 08:00");
  });

  it("the plans go in turn, as on the home screen", () => {
    expect(planQueue([A, B], WORKOUTS, 3).map((p) => p.id)).toEqual(["a", "b", "a"]);
    expect(planQueue([A, B], [], 2).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("week titles across months", () => {
    expect(weekTitleRange(new Date(2026, 9, 26))).toBe("26 октября – 1 ноября");
  });
});
