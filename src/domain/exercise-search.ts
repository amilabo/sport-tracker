import { searchKey } from "./text";
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from "./types";

/** Exercises matching every word of the query (in any order) and the muscle group filter. */
export function filterExercises(list: Exercise[], query: string, group: MuscleGroup | null): Exercise[] {
  const words = searchKey(query).split(" ").filter(Boolean);
  return list.filter((e) => {
    if (group && e.muscle_group !== group) return false;
    if (!words.length) return true;
    const name = searchKey(e.name);
    return words.every((w) => name.includes(w));
  });
}

/** Muscle groups that have at least one exercise, in the canonical order. */
export function presentGroups(list: Exercise[]): MuscleGroup[] {
  const present = new Set(list.map((e) => e.muscle_group));
  return MUSCLE_GROUPS.filter((g) => present.has(g));
}

/** Whether "create new «query»" makes sense: non-empty and no exercise with exactly this name. */
export function canCreateFromQuery(list: Exercise[], query: string): boolean {
  const key = searchKey(query);
  return key.length > 0 && !list.some((e) => searchKey(e.name) === key);
}
