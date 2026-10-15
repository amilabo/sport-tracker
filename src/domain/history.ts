import { formatNumber, parseDecimal, parseDurationInput } from "./format";
import { formatCardioDuration, formatClock } from "./sets";
import type { WorkoutSummary } from "./summary";
import type { Id, LogType, SetValues, Workout } from "./types";
import type { SetField } from "./workout";

// History feed (PRD §3.8): finished workouts, newest first, grouped by month.

export interface HistoryEntry {
  workout: Workout;
  /** null — a workout without a plan. */
  planName: string | null;
  summary: WorkoutSummary;
}

export interface HistoryMonth {
  /** "2026-10" */
  key: string;
  /** "Октябрь", or "Декабрь 2025" for another year. */
  title: string;
  entries: HistoryEntry[];
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export function monthTitle(date: Date, now: Date = new Date()): string {
  const name = MONTHS[date.getMonth()];
  return date.getFullYear() === now.getFullYear() ? name : `${name} ${date.getFullYear()}`;
}

/** Newest first; months in local time. */
export function groupByMonth(entries: HistoryEntry[], now: Date = new Date()): HistoryMonth[] {
  const sorted = [...entries].sort((a, b) => b.workout.started_at.localeCompare(a.workout.started_at));
  const months: HistoryMonth[] = [];
  for (const entry of sorted) {
    const d = new Date(entry.workout.started_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let month = months.at(-1);
    if (!month || month.key !== key) {
      month = { key, title: monthTitle(d, now), entries: [] };
      months.push(month);
    }
    month.entries.push(entry);
  }
  return months;
}

/** Filter chips: one per plan that has workouts, plus «Без плана». */
export const NO_PLAN = "none";
export function filterKey(workout: Workout): Id {
  return workout.plan_id ?? NO_PLAN;
}

/** «настроение 3 → 4»; a missing rating is a dash; null when neither was given. */
export function moodLine(before: number | null, after: number | null): string | null {
  if (before === null && after === null) return null;
  return `${before ?? "—"} → ${after ?? "—"}`;
}

/** A set in the workout card: "20 кг × 12", "+10 кг × 8", "12 раз", "0:30", "15 мин · 10 км/ч". */
export function formatSetDetail(logType: LogType, s: SetValues): string {
  switch (logType) {
    case "weight_reps":
      return s.weight === null ? `${s.reps ?? "—"} раз` : `${formatNumber(s.weight)} кг × ${s.reps ?? "—"}`;
    case "bodyweight_plus": {
      if (s.weight === null || s.weight === 0) return `${s.reps ?? "—"} раз`;
      const w = s.weight > 0 ? `+${formatNumber(s.weight)}` : `−${formatNumber(-s.weight)}`;
      return `${w} кг × ${s.reps ?? "—"}`;
    }
    case "reps":
      return `${s.reps ?? "—"} раз`;
    case "time":
      return s.duration_sec === null ? "—" : formatClock(s.duration_sec);
    case "cardio": {
      const parts: string[] = [];
      if (s.duration_sec !== null) parts.push(formatCardioDuration(s.duration_sec));
      if (s.speed_kmh !== null) parts.push(`${formatNumber(s.speed_kmh)} км/ч`);
      return parts.join(" · ") || "—";
    }
  }
}

// Editing a finished workout: values are typed as text and parsed on save.

/** Text shown in an edit field. Time as "0:30", cardio time as "15:00". */
export function fieldText(field: SetField, value: number | null): string {
  if (value === null) return "";
  if (field === "duration_sec") return formatClock(value);
  return field === "reps" ? String(value) : formatNumber(value, 2);
}

/** Parses an edit field; undefined — invalid. Empty is allowed (null) only for weight. */
export function parseField(logType: LogType, field: SetField, text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return field === "weight" ? null : undefined;
  switch (field) {
    case "weight": {
      const v = parseDecimal(t);
      if (v === null || Math.abs(v) > 999) return undefined;
      if (v < 0 && logType !== "bodyweight_plus") return undefined;
      return v;
    }
    case "reps": {
      const v = parseDecimal(t);
      return v !== null && Number.isInteger(v) && v >= 0 && v <= 999 ? v : undefined;
    }
    case "duration_sec": {
      const v = parseDurationInput(t, logType === "cardio" ? "min" : "sec");
      return v !== null && v <= 24 * 3600 ? v : undefined;
    }
    case "speed_kmh": {
      const v = parseDecimal(t);
      return v !== null && v >= 0 && v <= 99 ? v : undefined;
    }
  }
}
