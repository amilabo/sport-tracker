import type { WorkoutSet } from "../types";
import { E1RM_MAX_REPS } from "./thresholds";

/**
 * A set done on a timer (a timed circuit — stage 39, a set «вес · время · раз» — stage 47): it has a duration.
 * 15 squats in 0:40 is not the same as a set of 15 reps, so such sets give no ≈ максимум and no weight or volume
 * records. Applies to «вес × раз» and «свой вес ± кг» sets, whose duration is normally empty.
 */
export function isTimedSet(set: Pick<WorkoutSet, "duration_sec">): boolean {
  return set.duration_sec !== null && set.duration_sec !== undefined && set.duration_sec > 0;
}

/** Shown in steps of 0,5 kg with «≈». */
export function roundE1rm(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Epley: weight × (1 + reps / 30); one rep — the weight itself. null — no weight or more than 12 reps. */
export function e1rm(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null || weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export interface BestE1rm {
  /** Rounded to 0,5 kg. */
  value: number;
  set: WorkoutSet;
}

/** The best ≈ максимум of done, untimed sets — for «по лучшему подходу 22,5 кг × 10»; null — none counts. */
export function bestE1rm(sets: WorkoutSet[]): BestE1rm | null {
  let best: { raw: number; set: WorkoutSet } | null = null;
  for (const s of sets) {
    if (!s.done_at || isTimedSet(s)) continue;
    const v = e1rm(s.weight, s.reps);
    if (v !== null && (!best || v > best.raw)) best = { raw: v, set: s };
  }
  return best && { value: roundE1rm(best.raw), set: best.set };
}
