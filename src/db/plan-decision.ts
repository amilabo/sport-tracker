import type { PlanChange } from "@/domain/plan-diff";
import { exercisesRepo } from "./repos/exercises";
import { plansRepo } from "./repos/plans";

/**
 * «Обновить план?» — the checked lines written to the plan (stages 37, 41, 52): set values, own rest, «+1 подход»,
 * and the chosen way remembered for the exercise («Сначала предлагать»).
 */
export async function applyPlanDecision(checked: PlanChange[]): Promise<void> {
  if (!checked.length) return;
  await plansRepo.applySetUpdates(checked.flatMap((c) => c.updates));
  await plansRepo.applyRestUpdates(checked.flatMap((c) => (c.rest ? [c.rest] : [])));
  await plansRepo.addSetCopies(checked.flatMap((c) => (c.addSet ? [c.addSet.planExerciseId] : [])));
  for (const c of checked) {
    if (c.prefer) await exercisesRepo.setProgress(c.prefer.exerciseId, { progress_prefer: c.prefer.value });
  }
}
