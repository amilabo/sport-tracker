import { seedId } from "@/domain/ids";
import type { Exercise } from "@/domain/types";
import { CATALOG_DESCRIPTIONS } from "./exercise-descriptions";

/** «Как делать»: steps of a catalog exercise, or the text a person wrote for their own one. */
export type Technique =
  | { kind: "catalog"; steps: string[]; important: string }
  | { kind: "own"; text: string };

// Catalog descriptions ship with the app and are looked up by the stable seed id: not stored on the phone,
// not in the backup, cannot be edited, and an app update brings the corrected text everywhere at once.
const BY_ID = new Map(Object.entries(CATALOG_DESCRIPTIONS).map(([key, d]) => [seedId(`exercise:${key}`), d]));

export function techniqueOf(exercise: Pick<Exercise, "id" | "is_builtin" | "description">): Technique | null {
  const catalog = exercise.is_builtin ? BY_ID.get(exercise.id) : undefined;
  if (catalog) return { kind: "catalog", steps: catalog.steps, important: catalog.important };
  const text = exercise.description?.trim();
  return text ? { kind: "own", text } : null;
}

/** One line for the workout card: «Важно: …» of the catalog, or the first line of the person's own text. */
export function techniqueHint(t: Technique): string {
  if (t.kind === "catalog") return `Важно: ${t.important}`;
  return t.text.split("\n").find((l) => l.trim())!.trim();
}

export function upperFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase("ru") + s.slice(1);
}
