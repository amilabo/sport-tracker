import { catalogSubsOf } from "@/content/substitutes";
import type { SubstituteInput } from "@/domain/substitutes";
import type { Id } from "@/domain/types";
import { exercisesRepo } from "./exercises";
import { progressionsRepo } from "./progressions";
import { workoutsRepo } from "./workouts";

/** Everything «Чем заменить» needs for one exercise (docs/substitutes-architecture.md); the screen adds excludeIds. */
export async function substituteContext(exerciseId: Id): Promise<SubstituteInput | null> {
  const [target, exercises, chain, replaced] = await Promise.all([
    exercisesRepo.get(exerciseId),
    exercisesRepo.list(),
    progressionsRepo.chainOf(exerciseId),
    workoutsRepo.replacementsOf(exerciseId),
  ]);
  if (!target) return null;
  const catalog = catalogSubsOf(target);
  // Results only for exercises that can be shown: the reference, yours, past replacements, the chain, the group.
  const ids = new Set<Id>([
    ...catalog.map((c) => c.id),
    ...replaced.map((r) => r.exerciseId),
    ...(chain?.members.map((m) => m.id) ?? []),
    ...exercises.filter((e) => e.muscle_group === target.muscle_group).map((e) => e.id),
  ]);
  if (target.substitute_id) ids.add(target.substitute_id);
  // The target too: «Как в плане» shows its last result.
  ids.add(target.id);
  const last = await workoutsRepo.lastResultByExercise([...ids]);
  return {
    target,
    exercises,
    catalog,
    chain: chain && { name: chain.progression.name, members: chain.members },
    replaced,
    last,
  };
}
