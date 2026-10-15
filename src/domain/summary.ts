import type { Exercise, IsoDateTime, WorkoutExercise, WorkoutSet } from "./types";

export interface SummaryItem {
  we: WorkoutExercise;
  exercise: Exercise;
  replaced: Exercise | null;
  sets: WorkoutSet[];
}

export interface WorkoutSummary {
  doneSets: number;
  totalSets: number;
  /** 0–100, rounded. */
  percent: number;
  /** Σ weight × reps over done sets of weight_reps, and bodyweight_plus with added weight (PRD §3.5). */
  volumeKg: number;
  notDone: string[];
  replacements: string[];
}

export function setVolume(logType: Exercise["log_type"], s: WorkoutSet): number {
  if (!s.done_at || s.weight === null || s.reps === null) return 0;
  if (logType === "weight_reps" || (logType === "bodyweight_plus" && s.weight > 0)) return s.weight * s.reps;
  return 0;
}

function setList(numbers: number[]): string {
  return numbers.length === 1 ? `подход ${numbers[0]}` : `подходы ${numbers.join(", ")}`;
}

export function summarize(items: SummaryItem[]): WorkoutSummary {
  let doneSets = 0;
  let totalSets = 0;
  let volume = 0;
  const notDone: string[] = [];
  const replacements: string[] = [];

  for (const item of items) {
    const done = item.sets.filter((s) => s.done_at);
    doneSets += done.length;
    totalSets += item.sets.length;
    volume += item.sets.reduce((sum, s) => sum + setVolume(item.exercise.log_type, s), 0);
    if (item.we.skipped) notDone.push(`${item.exercise.name} — пропущено`);
    else {
      const missing = item.sets.map((s, i) => (s.done_at ? 0 : i + 1)).filter(Boolean);
      if (missing.length === item.sets.length && missing.length > 0) notDone.push(`${item.exercise.name} — не выполнено`);
      else if (missing.length) notDone.push(`${item.exercise.name} — ${setList(missing)}`);
    }
    if (item.replaced) replacements.push(`${item.exercise.name} вместо «${item.replaced.name}»`);
  }

  return {
    doneSets,
    totalSets,
    percent: totalSets ? Math.round((doneSets / totalSets) * 100) : 0,
    volumeKg: Math.round(volume),
    notDone,
    replacements,
  };
}

/** Workout length in minutes, never negative. */
export function durationMinutes(startedAt: IsoDateTime, finishedAt: IsoDateTime): number {
  return Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000));
}

/** "1:02" — hours and minutes. */
export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "1 ч 02 мин", "58 мин" — for history rows. */
export function formatDurationLong(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${String(minutes % 60).padStart(2, "0")} мин`;
}

/** "4 980" — thousands separated by a thin space, as in the mockups. */
export function formatKg(value: number): string {
  return Math.round(value).toLocaleString("ru-RU").replace(/\s/g, " ");
}
