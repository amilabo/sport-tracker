// APK A6 (apk/docs/a5-a7-design.md, mockups Н1–Н3): the reminders of «Ритм» — «План на неделю», «Завтра тренировка»,
// «Цель недели». Planned four weeks ahead as if no more workouts were done; planned again on every change, so a
// workout done takes away the reminders it made needless.
import { plural } from "./format";
import { pickNextPlan } from "./next-plan";
import { dayKey, doneByDay, weekStart } from "./rhythm";
import type { Id, IsoDateTime, Plan, Workout } from "./types";

/** Monday 0 … Sunday 6. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ReminderSettings {
  /** «Дни тренировок»; null — never chosen (the app suggests the habitual ones). */
  days: Weekday[] | null;
  /** The days were suggested by the app and not touched yet. */
  suggested?: boolean;
  weekly: { on: boolean; day: Weekday; time: string };
  tomorrow: { on: boolean; time: string };
  goal: { on: boolean; time: string };
}

/** All three are off until turned on one by one (decision of 01.11.2026). */
export const REMINDERS_DEFAULT: ReminderSettings = {
  days: null,
  weekly: { on: false, day: 6, time: "20:00" },
  tomorrow: { on: false, time: "20:00" },
  goal: { on: false, time: "18:00" },
};

export type ReminderKind = "weekly" | "tomorrow" | "goal";

export interface PlannedReminder {
  kind: ReminderKind;
  /** ms */
  at: number;
  title: string;
  text: string;
  /** The screen the tap opens. */
  path: string;
}

export interface ReminderInput {
  /** Active plans in list order, with their exercise counts. */
  plans: Plan[];
  exerciseCounts: Map<Id, number>;
  /** Completed workouts. */
  workouts: Pick<Workout, "started_at" | "status" | "plan_id">[];
  goal: number | null;
  settings: ReminderSettings;
  now: Date;
  weeks?: number;
}

export const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const WEEKDAYS_CAP = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WORKOUT_FORMS: [string, string, string] = ["тренировка", "тренировки", "тренировок"];
const EXERCISE_FORMS: [string, string, string] = ["упражнение", "упражнения", "упражнений"];
const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const weekdayOf = (d: Date) => ((d.getDay() + 6) % 7) as Weekday;

/** Local `day` at «20:00». */
function atTime(day: Date, time: string): number {
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0).getTime();
}

/** «3–9 ноября», «27 октября – 2 ноября». */
export function weekTitleRange(monday: Date): string {
  const end = addDays(monday, 6);
  return monday.getMonth() === end.getMonth()
    ? `${monday.getDate()}–${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`
    : `${monday.getDate()} ${MONTHS_GEN[monday.getMonth()]} – ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
}

/** The plans in the order they will come, the next one first (as «Следующая по очереди» on the home screen). */
export function planQueue(plans: Plan[], workouts: Pick<Workout, "started_at" | "status" | "plan_id">[], n: number): Plan[] {
  const last = new Map<Id, IsoDateTime>();
  for (const w of workouts) {
    if (!w.plan_id || (w.status !== "finished" && w.status !== "auto_finished")) continue;
    const prev = last.get(w.plan_id);
    if (!prev || w.started_at > prev) last.set(w.plan_id, w.started_at);
  }
  const out: Plan[] = [];
  for (let i = 0; i < n && plans.length; i++) {
    const p = pickNextPlan(plans, last)!;
    out.push(p);
    // As if done now, one after another: later than any real workout.
    last.set(p.id, `9999-${String(i).padStart(6, "0")}`);
  }
  return out;
}

/** Sorted days, Monday first. */
export function sortedDays(days: Weekday[] | null): Weekday[] {
  return [...new Set(days ?? [])].sort((a, b) => a - b);
}

/**
 * Every reminder from `now` on for `weeks` weeks, in time order. Rules (a5-a7-design.md, A6):
 * «План на неделю» — on its day, about the week to come (on a Monday — this one), the plans in turn on the chosen days;
 * «Завтра тренировка» — the evening before a chosen day, unless that week's goal is reached;
 * «Цель недели» — when the days left ≤ 2 × the workouts missing and the goal can still be reached; not on a day the
 * «Завтра» of the evening before was about.
 */
export function planReminders({ plans, exerciseCounts, workouts, goal, settings, now, weeks = 4 }: ReminderInput): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const days = sortedDays(settings.days);
  const chosen = new Set(days);
  const queue = planQueue(plans, workouts, Math.max(days.length, 1));
  const next = queue[0] ?? null;
  const done = doneByDay(workouts);
  const thisWeek = weekStart(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /** Workouts in the week of `day`, counting only the ones already done (none ahead). */
  const doneInWeek = (day: Date) => {
    const start = weekStart(day);
    if (start.getTime() !== thisWeek.getTime()) return 0;
    let n = 0;
    for (let i = 0; i < 7; i++) n += done.get(dayKey(addDays(start, i))) ?? 0;
    return n;
  };
  const goalReached = (day: Date) => goal !== null && doneInWeek(day) >= goal;
  // Days a «Завтра тренировка» was (or will be) about; yesterday evening's one counts for today.
  const tomorrowSent = new Set<string>();
  if (settings.tomorrow.on && chosen.has(weekdayOf(today))) tomorrowSent.add(dayKey(today));

  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(today, i);
    const wd = weekdayOf(day);

    if (settings.weekly.on && days.length && wd === settings.weekly.day) {
      const at = atTime(day, settings.weekly.time);
      const monday = wd === 0 ? day : addDays(weekStart(day), 7);
      if (at > now.getTime()) {
        const lines = days.map((d, k) => `${WEEKDAYS_CAP[d]} — ${queue[k % Math.max(queue.length, 1)]?.name ?? "тренировка"}`);
        out.push({
          kind: "weekly",
          at,
          title: `Неделя ${weekTitleRange(monday)}: ${days.length} ${plural(days.length, WORKOUT_FORMS)}`,
          text: lines.join("\n"),
          path: "/rhythm/",
        });
      }
    }

    const tomorrow = addDays(day, 1);
    if (settings.tomorrow.on && chosen.has(weekdayOf(tomorrow)) && !goalReached(tomorrow)) {
      const at = atTime(day, settings.tomorrow.time);
      if (at > now.getTime()) {
        tomorrowSent.add(dayKey(tomorrow));
        const n = next ? (exerciseCounts.get(next.id) ?? 0) : 0;
        out.push({
          kind: "tomorrow",
          at,
          title: "Завтра тренировка",
          text: next ? `${next.name}${n ? ` · ${n} ${plural(n, EXERCISE_FORMS)}` : ""}` : "По вашим дням тренировок",
          path: "/",
        });
      }
    }

    if (settings.goal.on && goal !== null && !tomorrowSent.has(dayKey(day))) {
      const count = doneInWeek(day);
      const missing = goal - count;
      const left = 7 - wd;
      const at = atTime(day, settings.goal.time);
      if (missing > 0 && missing <= left && left <= 2 * missing && at > now.getTime()) {
        const last = left === 1;
        out.push({
          kind: "goal",
          at,
          title: last ? "Последний день недели" : "Неделя ещё может сложиться",
          text: last
            ? `Одна тренировка — и будет ${goal} из ${goal}`
            : `Пока ${count} из ${goal}, до конца недели ${left} ${plural(left, DAY_FORMS)}.${next ? ` Следующая — ${next.name}` : ""}`,
          path: next && chosen.has(wd) ? `/workout/?plan=${next.id}` : "/",
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** «Дни тренировок» suggested from the last 8 weeks: the habitual weekdays (the highlighted bars of «Когда вы обычно ходите»). */
export function suggestDays(habit: { top: boolean }[]): Weekday[] {
  return habit.flatMap((h, i) => (h.top ? [i as Weekday] : []));
}
