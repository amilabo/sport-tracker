// Rest between sets and exercises (stage 34): plan type, defaults, own values, the snapshot a workout keeps.
import { formatClock } from "./sets";
import { PLAN_FORMATS, type Plan, type PlanExercise, type PlanFormat, type RestSnapshot } from "./types";

export const REST_DEFAULTS = { set: 60, exercise: 120 } as const;
export const REST_STEP = 15;
export const REST_MAX = 30 * 60;
/** Ready-made values in the «Отдых» sheet. */
export const REST_PRESETS = [30, 60, 90, 120, 180, 300] as const;

export const FORMAT_LABELS: Record<PlanFormat, string> = {
  strength: "Силовая",
  rest: "С отдыхом",
  circuit: "Круговая",
};

/** Plan types offered in the editor. «Круговая» comes with circuits (stage 36). */
export const EDITOR_FORMATS: PlanFormat[] = ["strength", "rest"];

export interface RestSettings {
  format: PlanFormat;
  rest_set_sec: number;
  rest_exercise_sec: number;
}

/** A stored rest value as whole seconds within 0…30 min; anything else (absent, broken import) — null. */
export function cleanRest(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(REST_MAX, Math.round(value));
}

export function planFormat(plan: Pick<Plan, "format"> | null | undefined): PlanFormat {
  const f = plan?.format;
  return f && (PLAN_FORMATS as readonly string[]).includes(f) ? f : "strength";
}

/** The plan's type and rest defaults; a plan without them is «Силовая» with 1:00 / 2:00 ready for a switch. */
export function restSettings(plan: Pick<Plan, "format" | "rest_set_sec" | "rest_exercise_sec"> | null | undefined): RestSettings {
  return {
    format: planFormat(plan),
    rest_set_sec: cleanRest(plan?.rest_set_sec) ?? REST_DEFAULTS.set,
    rest_exercise_sec: cleanRest(plan?.rest_exercise_sec) ?? REST_DEFAULTS.exercise,
  };
}

/** Whether the plan record carries rest settings at all (it was switched to another type once). */
export function hasRestSettings(plan: Pick<Plan, "format"> | null | undefined): boolean {
  return plan?.format !== undefined;
}

export function usesRest(format: PlanFormat): boolean {
  return format !== "strength";
}

/** What a workout keeps from the plan at start; null for «Силовая» — the workout stays exactly as before. */
export function restSnapshot(plan: Pick<Plan, "format" | "rest_set_sec" | "rest_exercise_sec"> | null | undefined): RestSnapshot | null {
  const s = restSettings(plan);
  return usesRest(s.format) ? s : null;
}

/** The exercise's own rest between sets, or null — the plan's. */
export function ownRest(pe: Pick<PlanExercise, "rest_set_sec"> | null | undefined): number | null {
  return cleanRest(pe?.rest_set_sec);
}

/** Rest between sets of one exercise: its own value, else the plan's. */
export function setRestFor(settings: Pick<RestSettings, "rest_set_sec">, own: number | null | undefined): number {
  return cleanRest(own) ?? settings.rest_set_sec;
}

/** −/+ 15 s, within 0…30 min; an off-grid value snaps to the grid first. */
export function stepRest(value: number, dir: 1 | -1): number {
  const snapped = dir > 0 ? Math.floor(value / REST_STEP) * REST_STEP : Math.ceil(value / REST_STEP) * REST_STEP;
  return Math.max(0, Math.min(REST_MAX, snapped + dir * REST_STEP));
}

/** «1:30»; zero is «0:00» — the sheet labels it «без отдыха». */
export function formatRest(sec: number): string {
  return formatClock(sec);
}
