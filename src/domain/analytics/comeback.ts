import type { Exercise, IsoDateTime, Workout, WorkoutSet } from "../types";
import { COMEBACK_DAYS } from "./thresholds";
import { roundDownToStep, weightStep } from "./weight-step";

// Back after a break (stage 44, mockup А5): after 14+ days without workouts the draft offers lower weights
// for this workout only. The plan does not change, and the finish screen does not offer to lower it either.

const DAY_MS = 86_400_000;

function localMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar days from the latest completed workout started before `now` to `now`; null — none yet. */
export function daysSinceLast(workouts: Pick<Workout, "id" | "started_at" | "status">[], now: Date, excludeId?: string): number | null {
  let last: IsoDateTime | null = null;
  for (const w of workouts) {
    if (w.id === excludeId || (w.status !== "finished" && w.status !== "auto_finished")) continue;
    if (w.started_at >= now.toISOString()) continue;
    if (!last || w.started_at > last) last = w.started_at;
  }
  if (!last) return null;
  // Calendar days, so that a workout on the 12th and today the 30th is «18 дней» whatever the hours.
  return Math.round((localMidnight(now) - localMidnight(new Date(last))) / DAY_MS);
}

/** The first workout after a break: the draft card, and no «lower the plan» lines on finishing. */
export function isComeback(days: number | null): days is number {
  return days !== null && days >= COMEBACK_DAYS;
}

/** The plan's weight lowered by `pct` %, rounded down to the equipment step. */
export function lowerWeight(weight: number, pct: number, equipment: Exercise["equipment"]): number {
  if (pct <= 0 || weight <= 0) return weight;
  return roundDownToStep(weight * (1 - pct / 100), weightStep(equipment));
}

/** Whether lowering applies: «вес × раз» only; own weight, assistance and cardio stay as planned. */
export function lowersWeight(exercise: Pick<Exercise, "log_type">): boolean {
  return exercise.log_type === "weight_reps";
}

/**
 * The draft's sets with weights `pct` % below the plan (0 — as in the plan). Only sets from the plan with a weight;
 * the rest come back unchanged (same objects), so callers can tell what changed.
 */
export function comebackSets(exercise: Pick<Exercise, "log_type" | "equipment">, sets: WorkoutSet[], pct: number): WorkoutSet[] {
  if (!lowersWeight(exercise)) return sets;
  return sets.map((s) => {
    if (!s.plan_set_id || s.target_weight === null || s.target_weight <= 0) return s;
    const weight = lowerWeight(s.target_weight, pct, exercise.equipment);
    return weight === s.weight ? s : { ...s, weight };
  });
}

/** «в плане 45 кг» under a lowered exercise; «в плане 40 · 45 кг» when sets differ; null — nothing lowered. */
export function planWeightNote(sets: WorkoutSet[], format: (kg: number) => string): string | null {
  const lowered = sets.filter((s) => s.target_weight !== null && s.weight !== null && s.weight < s.target_weight);
  if (!lowered.length) return null;
  const weights = [...new Set(lowered.map((s) => s.target_weight!))];
  return `в плане ${weights.map(format).join(" · ")} кг`;
}
