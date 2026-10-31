import type { IsoDateTime, Workout } from "./types";

// «Ритм» (stage 32, docs/schedule-design.md, mockups 24А, 25, 26): one setting — workouts a week;
// everything else is counted from logged workouts. A week is Monday–Sunday in local time.

export const GOAL_MIN = 1;
export const GOAL_MAX = 6;
export const GOAL_DEFAULT = 2;

/** «2 раза в неделю», «5 раз в неделю». */
export function goalWord(n: number): string {
  return n >= 2 && n <= 4 ? "раза" : "раз";
}

const LETTERS = ["П", "В", "С", "Ч", "П", "С", "В"];
const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const WEEKDAYS_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

/** «2026-10-28» of a local date. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of the Monday of d's week. */
export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Completed workouts (finished or finished automatically) by local day of their start; two in a day count twice. */
export function doneByDay(workouts: Pick<Workout, "started_at" | "status">[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const w of workouts) {
    if (w.status !== "finished" && w.status !== "auto_finished") continue;
    const key = dayKey(new Date(w.started_at as IsoDateTime));
    days.set(key, (days.get(key) ?? 0) + 1);
  }
  return days;
}

export interface WeekDay {
  key: string;
  /** П В С Ч П С В */
  letter: string;
  /** Full weekday for the screen reader: «понедельник». */
  name: string;
  done: boolean;
  today: boolean;
  /** Before today and without a workout: shown muted. */
  past: boolean;
}

/** This week for the home strip: seven days and how many workouts so far. */
export function currentWeek(done: Map<string, number>, now: Date): { days: WeekDay[]; count: number } {
  const start = weekStart(now);
  const today = dayKey(now);
  let count = 0;
  const days = LETTERS.map((letter, i) => {
    const key = dayKey(addDays(start, i));
    const n = done.get(key) ?? 0;
    count += n;
    return { key, letter, name: WEEKDAYS_FULL[i], done: n > 0, today: key === today, past: key < today && n === 0 };
  });
  return { days, count };
}

export interface WeekRow {
  /** Monday of the week. */
  key: string;
  /** «19–25 окт», «26 окт – 1 ноя». */
  range: string;
  /** Days with workouts: «ср, пт»; «пн · идёт неделя» for the current one. */
  days: string;
  count: number;
  current: boolean;
}

function weekRange(start: Date): string {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

function weekRow(start: Date, done: Map<string, number>, current: boolean): WeekRow {
  const names: string[] = [];
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const c = done.get(dayKey(addDays(start, i))) ?? 0;
    if (c) names.push(WEEKDAYS[i]);
    count += c;
  }
  const list = names.join(", ");
  return {
    key: dayKey(start),
    range: weekRange(start),
    days: current ? (list ? `${list} · идёт неделя` : "идёт неделя") : list || "не было",
    count,
    current,
  };
}

/** The last `n` weeks, the current one first. */
export function recentWeeks(done: Map<string, number>, now: Date, n = 8): WeekRow[] {
  const first = weekStart(now);
  return Array.from({ length: n }, (_, w) => weekRow(addDays(first, -7 * w), done, w === 0));
}

/**
 * «Недели <месяца>» (stage 42а, mockup А3): the weeks with at least one day in the month shown, newest first.
 * A week across two months is listed in both; weeks that have not started yet are not.
 */
export function monthWeeks(year: number, month: number, done: Map<string, number>, now: Date): WeekRow[] {
  const thisWeek = dayKey(weekStart(now));
  const rows: WeekRow[] = [];
  const last = new Date(year, month + 1, 0);
  for (let start = weekStart(new Date(year, month, 1)); start <= last && start <= now; start = addDays(start, 7)) {
    rows.push(weekRow(start, done, dayKey(start) === thisWeek));
  }
  return rows.reverse();
}

export interface WeekWorkout {
  id: string;
  /** «пн 19.10». */
  day: string;
  /** The plan's name, «Без плана» for a free workout. */
  plan: string;
  /** «58 мин», «1:04»; null — no end time. */
  duration: string | null;
}

/** «58 мин» under an hour, «1:04» from an hour. */
export function shortDuration(minutes: number): string {
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * A week opened in the list (А3): its workouts oldest first, days of the neighbouring month included, and the total —
 * done sets and volume. `entries` — completed workouts with plan names and summaries (the history list).
 */
export function weekWorkouts(
  weekKey: string,
  entries: { workout: Pick<Workout, "id" | "started_at" | "finished_at">; planName: string | null; summary: { doneSets: number; volumeKg: number } }[],
): { items: WeekWorkout[]; sets: number; volume: number } {
  const [y, m, d] = weekKey.split("-").map(Number);
  const from = new Date(y, m - 1, d).getTime();
  const to = new Date(y, m - 1, d + 7).getTime();
  const inWeek = entries
    .filter((e) => {
      const t = new Date(e.workout.started_at).getTime();
      return t >= from && t < to;
    })
    .sort((a, b) => a.workout.started_at.localeCompare(b.workout.started_at));
  return {
    items: inWeek.map((e) => {
      const at = new Date(e.workout.started_at);
      const minutes = e.workout.finished_at ? Math.max(0, Math.round((new Date(e.workout.finished_at).getTime() - at.getTime()) / 60000)) : null;
      return {
        id: e.workout.id,
        day: `${WEEKDAYS[(at.getDay() + 6) % 7]} ${String(at.getDate()).padStart(2, "0")}.${String(at.getMonth() + 1).padStart(2, "0")}`,
        plan: e.planName ?? "Без плана",
        duration: minutes === null ? null : shortDuration(minutes),
      };
    }),
    sets: inWeek.reduce((n, e) => n + e.summary.doneSets, 0),
    volume: inWeek.reduce((n, e) => n + e.summary.volumeKg, 0),
  };
}

/** «N из M недель в ритме»: finished weeks with at least `goal` workouts; the current week is not counted until it ends. */
export function weeksInRhythm(weeks: WeekRow[], goal: number): { full: number; total: number } {
  const past = weeks.filter((w) => !w.current);
  return { full: past.filter((w) => w.count >= goal).length, total: past.length };
}

export interface MonthCell {
  key: string;
  day: number;
  done: boolean;
  today: boolean;
  future: boolean;
}

/** A month as a Monday-first grid: leading nulls, then every day. */
export function monthGrid(year: number, month: number, done: Map<string, number>, now: Date): { cells: (MonthCell | null)[]; count: number } {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const today = dayKey(now);
  const cells: (MonthCell | null)[] = Array.from({ length: (first.getDay() + 6) % 7 }, () => null);
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const key = dayKey(new Date(year, month, d));
    const n = done.get(key) ?? 0;
    count += n;
    cells.push({ key, day: d, done: n > 0, today: key === today, future: key > today });
  }
  return { cells, count };
}

/**
 * «Когда вы обычно ходите»: workouts per weekday over the last `weeks` weeks (this one included).
 * Habitual days — those with at least ¾ of the busiest day's workouts (вт 7 and чт 6 are both habitual);
 * they are highlighted in the bars, not spelled out as a hint.
 */
export function habitDays(done: Map<string, number>, now: Date, weeks = 8): { name: string; count: number; top: boolean }[] {
  const start = addDays(weekStart(now), -7 * (weeks - 1));
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < weeks * 7; i++) counts[i % 7] += done.get(dayKey(addDays(start, i))) ?? 0;
  const max = Math.max(...counts);
  return counts.map((count, i) => ({ name: WEEKDAYS[i], count, top: max > 0 && count >= max * 0.75 }));
}
