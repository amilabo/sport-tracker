import { buildDemo, type DemoPlan } from "@/domain/demo";
import { DomainError, STORE_NAMES, type StoreName } from "@/domain/types";
import { getDb, withTx } from "../client";

/** Stores where demo records can live. */
const DEMO_STORES: StoreName[] = ["workouts", "workout_exercises", "workout_sets", "measurements"];

export const demoRepo = {
  async isLoaded(): Promise<boolean> {
    const db = await getDb();
    for (const name of DEMO_STORES) {
      const all = (await db.getAll(name)) as { is_demo: boolean }[];
      if (all.some((r) => r.is_demo)) return true;
    }
    return false;
  },

  /** Workouts by the first two active plans (or one), plus measurements. Does nothing if demo is already loaded. */
  async load(now: Date = new Date()): Promise<void> {
    await withTx([...DEMO_STORES, "plans", "plan_exercises", "plan_sets", "exercises", "measurement_types"], "readwrite", async (tx) => {
      if ((await tx.objectStore("workouts").getAll()).some((w) => w.is_demo)) return;
      const plans = (await tx.objectStore("plans").getAll()).filter((p) => !p.archived_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 2);
      if (!plans.length) throw new DomainError("Для демо-данных нужен хотя бы один план");
      const demoPlans: DemoPlan[] = [];
      for (const plan of plans) {
        const pes = (await tx.objectStore("plan_exercises").index("plan_id").getAll(plan.id)).sort((a, b) => a.position - b.position);
        const items: DemoPlan["items"] = [];
        for (const pe of pes) {
          const exercise = await tx.objectStore("exercises").get(pe.exercise_id);
          const sets = (await tx.objectStore("plan_sets").index("plan_exercise_id").getAll(pe.id)).sort((a, b) => a.position - b.position);
          if (exercise) items.push({ planExercise: pe, exercise, sets });
        }
        demoPlans.push({ plan, items });
      }
      const records = buildDemo(demoPlans, await tx.objectStore("measurement_types").getAll(), now);
      for (const w of records.workouts) await tx.objectStore("workouts").put(w);
      for (const we of records.workout_exercises) await tx.objectStore("workout_exercises").put(we);
      for (const s of records.workout_sets) await tx.objectStore("workout_sets").put(s);
      for (const m of records.measurements) await tx.objectStore("measurements").put(m);
    });
  },

  /** Removes only records marked is_demo, in every store; real records and the catalog stay. */
  async remove(): Promise<void> {
    await withTx(STORE_NAMES, "readwrite", async (tx) => {
      for (const name of STORE_NAMES) {
        const store = tx.objectStore(name);
        const rows = (await store.getAll()) as { id: string; is_demo: boolean }[];
        for (const r of rows) if (r.is_demo) await store.delete(r.id);
      }
    });
  },
};
