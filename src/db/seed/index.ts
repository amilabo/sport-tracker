import { newEntity } from "@/domain/entity";
import { seedId } from "@/domain/ids";
import { nowIso } from "@/domain/time";
import {
  SETTINGS_ID,
  type Exercise,
  type MeasurementType,
  type Plan,
  type PlanExercise,
  type PlanSet,
  type Settings,
} from "@/domain/types";
import { SCHEMA_VERSION, type TrackerDatabase } from "../schema";
import { SEED_EXERCISES, SEED_MEASUREMENT_TYPES, SEED_PLANS } from "./catalog";

// Stable ids: the same on every device, see seedId().
export const exerciseSeedId = (key: string) => seedId(`exercise:${key}`);
export const planSeedId = (key: string) => seedId(`plan:${key}`);
export const measurementTypeSeedId = (key: string) => seedId(`measurement_type:${key}`);

export interface SeedData {
  exercises: Exercise[];
  plans: Plan[];
  planExercises: PlanExercise[];
  planSets: PlanSet[];
  measurementTypes: MeasurementType[];
  settings: Settings;
}

/**
 * Catalog, starter plans and measurement types are dated as shipped with the app, not the first launch:
 * otherwise on a new phone they would look newer than the user's changes from a backup, and «Объединить»
 * would keep the untouched starter version (lost progression links, plan weights). Settings keep the real
 * first-launch time — the backup reminder counts from it.
 */
export const SEED_AT = "2000-01-01T00:00:00.000Z";

export function buildSeedData(at: string = nowIso()): SeedData {
  const exercises: Exercise[] = SEED_EXERCISES.map((e) =>
    newEntity(
      {
        name: e.name,
        muscle_group: e.muscle_group,
        equipment: e.equipment,
        log_type: e.log_type,
        is_builtin: true,
        archived_at: null,
        progression_id: null,
        progression_level: null,
      },
      { id: exerciseSeedId(e.key), at: SEED_AT },
    ),
  );

  const plans: Plan[] = [];
  const planExercises: PlanExercise[] = [];
  const planSets: PlanSet[] = [];
  SEED_PLANS.forEach((p) => {
    const planId = planSeedId(p.key);
    plans.push(newEntity({ name: p.name, source: "self" as const, archived_at: null }, { id: planId, at: SEED_AT }));
    p.items.forEach((item, position) => {
      const peId = seedId(`plan_exercise:${p.key}:${position}`);
      planExercises.push(
        newEntity(
          { plan_id: planId, exercise_id: exerciseSeedId(item.exercise), position, note: item.note ?? null },
          { id: peId, at: SEED_AT },
        ),
      );
      item.sets.forEach((v, setPos) => {
        planSets.push(
          newEntity(
            {
              plan_exercise_id: peId,
              position: setPos,
              weight: v.weight ?? null,
              reps: v.reps ?? null,
              duration_sec: v.duration_sec ?? null,
              speed_kmh: v.speed_kmh ?? null,
            },
            { id: seedId(`plan_set:${p.key}:${position}:${setPos}`), at: SEED_AT },
          ),
        );
      });
    });
  });

  const measurementTypes: MeasurementType[] = SEED_MEASUREMENT_TYPES.map((t, position) =>
    newEntity(
      {
        name: t.name,
        unit: t.unit,
        key: t.key,
        is_builtin: true,
        archived_at: null,
        computed: t.computed,
        base_type_id: t.base ? measurementTypeSeedId(t.base) : null,
        position,
      },
      { id: measurementTypeSeedId(t.key), at: SEED_AT },
    ),
  );

  const settings: Settings = newEntity(
    {
      last_export_at: null,
      install_hint_dismissed: false,
      schema_version: SCHEMA_VERSION,
      height_cm: null,
      theme_mode: "system" as const,
      color_theme: "card",
    },
    { id: SETTINGS_ID, at },
  );

  return { exercises, plans, planExercises, planSets, measurementTypes, settings };
}

/** First launch: catalog, starter plans, measurement types and settings in one transaction. */
export async function seedIfNeeded(db: TrackerDatabase): Promise<boolean> {
  if (await db.get("settings", SETTINGS_ID)) return false;

  const data = buildSeedData();
  const tx = db.transaction(
    ["exercises", "plans", "plan_exercises", "plan_sets", "measurement_types", "settings"],
    "readwrite",
  );
  // Seed ids are stable, so if two tabs seed at once they write the same records: no duplicates.
  // The settings record goes last in the same transaction and marks the seed as done.
  await Promise.all([
    ...data.exercises.map((r) => tx.objectStore("exercises").put(r)),
    ...data.plans.map((r) => tx.objectStore("plans").put(r)),
    ...data.planExercises.map((r) => tx.objectStore("plan_exercises").put(r)),
    ...data.planSets.map((r) => tx.objectStore("plan_sets").put(r)),
    ...data.measurementTypes.map((r) => tx.objectStore("measurement_types").put(r)),
    tx.objectStore("settings").put(data.settings),
  ]);
  await tx.done;
  return true;
}
