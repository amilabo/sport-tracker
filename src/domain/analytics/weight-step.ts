import type { Equipment } from "../types";

/**
 * The smallest weight change for the equipment (decision of 30.10.2026): barbell, machine, cable — 2,5 kg;
 * dumbbells (also «гантели / гиря») — 1 kg; a kettlebell — 4 kg (8, 12, 16…); anything else — 2,5 kg.
 * Used when the app suggests a weight; the −/+ buttons in the gym keep their own step.
 */
export function weightStep(equipment: Equipment): number {
  switch (equipment) {
    case "dumbbells":
    case "dumbbells_kettlebell":
      return 1;
    case "kettlebell":
      return 4;
    default:
      return 2.5;
  }
}

/** `weight` rounded down to the step; never below one step, never above the weight itself. */
export function roundDownToStep(weight: number, step: number): number {
  // 1e-9: 22,5 × 0,9 / 2,5 must not fall to the step below because of float error.
  const down = Math.floor(weight / step + 1e-9) * step;
  return Math.min(weight, Math.max(step, Math.round(down * 100) / 100));
}
