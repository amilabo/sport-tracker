import type { Id, IsoDateTime, Plan } from "./types";

/**
 * "Next in line" (PRD §3.3): the plan done longest ago. A plan never done counts as done longest ago,
 * so plans rotate (Legs → Glutes → Legs…); among never-done plans the first in the list wins.
 */
export function pickNextPlan(plans: Plan[], lastByPlan: Map<Id, IsoDateTime>): Plan | null {
  if (plans.length === 0) return null;
  const neverDone = plans.find((p) => !lastByPlan.has(p.id));
  if (neverDone) return neverDone;
  return plans.reduce((a, b) => (lastByPlan.get(b.id)! < lastByPlan.get(a.id)! ? b : a));
}
