import { seedId } from "@/domain/ids";
import type { Exercise, Id } from "@/domain/types";
import { CATALOG_SUBSTITUTES, type Relation } from "./exercise-substitutes";

/** A substitute from the reference, by exercise id: «то же движение · гантели, по одной руке». */
export interface CatalogSub {
  id: Id;
  relation: Relation;
  note: string;
}

// Like the descriptions: the reference ships with the app and is looked up by the stable seed id —
// not stored on the phone, not in the backup; a renamed catalog exercise keeps its substitutes.
const BY_ID = new Map(
  Object.entries(CATALOG_SUBSTITUTES).map(([key, d]) => [
    seedId(`exercise:${key}`),
    d.subs.map((s) => ({ id: seedId(`exercise:${s.key}`), relation: s.relation, note: s.note })),
  ]),
);

/** Substitutes of a catalog exercise in order of priority; none for a person's own one. */
export function catalogSubsOf(exercise: Pick<Exercise, "id" | "is_builtin">): CatalogSub[] {
  return (exercise.is_builtin && BY_ID.get(exercise.id)) || [];
}
