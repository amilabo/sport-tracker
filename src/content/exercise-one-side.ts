import { seedId } from "@/domain/ids";
import type { Exercise } from "@/domain/types";

// Catalog exercises done one side at a time (stage 51а). Only a hint for «На каждую сторону?» (mockup Р6): whether
// the plan keeps the sum (20 = 10 + 10) or one side (12 per arm) is the person's habit, so nothing is set by itself.
export const CATALOG_ONE_SIDE = [
  "single_leg_balance_hinge",
  "single_leg_glute_bridge",
  "bulgarian_split_squat",
  "dumbbell_lunges",
  "smith_lunge",
  "reverse_lunge",
  "step_up",
  "cable_kickback",
  "cable_lateral_raise",
  "dumbbell_row",
  "concentration_curl",
] as const;

const IDS = new Set<string>(CATALOG_ONE_SIDE.map((key) => seedId(`exercise:${key}`)));

/** A catalog exercise done one side at a time. */
export function isOneSideCatalog(exercise: Pick<Exercise, "id" | "is_builtin">): boolean {
  return exercise.is_builtin && IDS.has(exercise.id);
}
