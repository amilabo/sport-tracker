import { newEntity, touch } from "@/domain/entity";
import { cleanCircuits, usedCircuits } from "@/domain/circuit";
import { cleanRest, hasRestSettings, ownRest, restSettings, type RestSettings } from "@/domain/rest";
import { cleanName } from "@/domain/text";
import { nowIso } from "@/domain/time";
import {
  DomainError,
  type BaseEntity,
  type Exercise,
  type Id,
  type Plan,
  type PlanCircuit,
  type PlanExercise,
  type PlanSet,
  type SetValues,
} from "@/domain/types";
import { getDb, withTx } from "../client";

export interface PlanItem {
  planExercise: PlanExercise;
  exercise: Exercise;
  sets: PlanSet[];
}

export interface PlanFull {
  plan: Plan;
  items: PlanItem[];
}

/** Editable plan shape. Existing rows keep their ids so workouts can still refer to them. */
export interface PlanDraftSet extends SetValues {
  id?: Id;
}
export interface PlanDraftItem {
  id?: Id;
  exercise_id: Id;
  note: string | null;
  sets: PlanDraftSet[];
  /** Own rest between sets; null — the plan's. */
  rest_set_sec?: number | null;
  /** Circuit group (stage 36); null — none. */
  circuit_id?: Id | null;
}
export interface PlanDraft {
  id?: Id;
  name: string;
  items: PlanDraftItem[];
  /** Type and rest defaults. Omitted — a «Силовая» plan stays without rest fields (as before stage 34). */
  rest?: RestSettings;
  /** Circuits (stage 36). Omitted — the plan keeps none; groups no exercise uses are dropped. */
  circuits?: PlanCircuit[];
}

const PLAN_STORES = ["plans", "plan_exercises", "plan_sets"] as const;

const SET_FIELDS = ["weight", "reps", "duration_sec", "speed_kmh"] as const;

/** Keeps created_at and updated_at of a row whose fields did not change. */
function upsert<T extends BaseEntity>(existing: T | undefined, fields: Partial<Omit<T, keyof BaseEntity>>): T {
  if (!existing) return newEntity(fields) as unknown as T;
  const changed = (Object.keys(fields) as (keyof typeof fields)[]).some((k) => existing[k as keyof T] !== fields[k]);
  return changed ? touch(existing, fields as Partial<Omit<T, keyof BaseEntity>>) : existing;
}

export const plansRepo = {
  /** Plans in creation order — "the first in the list" on the home screen. */
  async list({ includeArchived = false } = {}): Promise<Plan[]> {
    const all = await (await getDb()).getAll("plans");
    return all
      .filter((p) => includeArchived || !p.archived_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
  },

  async listArchived(): Promise<Plan[]> {
    const all = await (await getDb()).getAll("plans");
    return all.filter((p) => p.archived_at).sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));
  },

  async get(id: Id): Promise<Plan | undefined> {
    return (await getDb()).get("plans", id);
  },

  async getFull(id: Id): Promise<PlanFull | undefined> {
    return withTx([...PLAN_STORES, "exercises"], "readonly", async (tx) => {
      const plan = await tx.objectStore("plans").get(id);
      if (!plan) return undefined;
      const pes = (await tx.objectStore("plan_exercises").index("plan_id").getAll(id)).sort((a, b) => a.position - b.position);
      const items = await Promise.all(
        pes.map(async (pe) => {
          const [exercise, sets] = await Promise.all([
            tx.objectStore("exercises").get(pe.exercise_id),
            tx.objectStore("plan_sets").index("plan_exercise_id").getAll(pe.id),
          ]);
          return exercise ? { planExercise: pe, exercise, sets: sets.sort((a, b) => a.position - b.position) } : null;
        }),
      );
      return { plan, items: items.filter((i): i is PlanItem => i !== null) };
    });
  },

  /** Exercise count per plan, for plan cards. */
  async exerciseCounts(): Promise<Map<Id, number>> {
    const all = await (await getDb()).getAll("plan_exercises");
    const counts = new Map<Id, number>();
    all.forEach((pe) => counts.set(pe.plan_id, (counts.get(pe.plan_id) ?? 0) + 1));
    return counts;
  },

  /** Creates or replaces a plan with its exercises and sets in one transaction. Returns the plan id. */
  async save(draft: PlanDraft): Promise<Id> {
    const name = cleanName(draft.name);
    if (!name) throw new DomainError("Введите название плана");

    return withTx([...PLAN_STORES], "readwrite", async (tx) => {
      const plans = tx.objectStore("plans");
      const peStore = tx.objectStore("plan_exercises");
      const setStore = tx.objectStore("plan_sets");

      const existingPlan = draft.id ? await plans.get(draft.id) : undefined;
      if (draft.id && !existingPlan) throw new DomainError("План не найден");
      const rest = draft.rest
        ? { format: draft.rest.format, rest_set_sec: cleanRest(draft.rest.rest_set_sec) ?? 0, rest_exercise_sec: cleanRest(draft.rest.rest_exercise_sec) ?? 0 }
        : {};
      const circuits = draft.circuits
        ? usedCircuits(cleanCircuits(draft.circuits), draft.items.map((i) => i.circuit_id ?? null))
        : undefined;
      const sameCircuits = JSON.stringify(circuits ?? []) === JSON.stringify(existingPlan?.circuits ?? []);
      const plan = upsert<Plan>(existingPlan, {
        name,
        source: existingPlan?.source ?? "self",
        archived_at: existingPlan?.archived_at ?? null,
        ...rest,
        ...(circuits && !sameCircuits ? { circuits } : {}),
      });
      await plans.put(plan);

      const oldPes = existingPlan ? await peStore.index("plan_id").getAll(plan.id) : [];
      const oldSetsByPe = new Map<Id, PlanSet[]>();
      await Promise.all(
        oldPes.map(async (pe) => oldSetsByPe.set(pe.id, await setStore.index("plan_exercise_id").getAll(pe.id))),
      );
      const oldPeById = new Map(oldPes.map((pe) => [pe.id, pe]));
      const keptPe = new Set<Id>();
      const keptSets = new Set<Id>();

      for (const [position, item] of draft.items.entries()) {
        const prevPe = item.id ? oldPeById.get(item.id) : undefined;
        const own = cleanRest(item.rest_set_sec);
        const circuitId = item.circuit_id ?? null;
        const pe = upsert<PlanExercise>(prevPe, {
          plan_id: plan.id,
          exercise_id: item.exercise_id,
          position,
          note: item.note ? cleanName(item.note) || null : null,
          // Written only when there is (or was) an own value: plain plans keep their records unchanged.
          ...(own !== null || prevPe?.rest_set_sec != null ? { rest_set_sec: own } : {}),
          ...(circuitId !== null || prevPe?.circuit_id != null ? { circuit_id: circuitId } : {}),
        });
        keptPe.add(pe.id);
        if (pe !== prevPe) await peStore.put(pe);

        const prevSets = new Map((oldSetsByPe.get(pe.id) ?? []).map((s) => [s.id, s]));
        for (const [setPos, s] of item.sets.entries()) {
          const prevSet = s.id ? prevSets.get(s.id) : undefined;
          const fields = { plan_exercise_id: pe.id, position: setPos } as Omit<PlanSet, keyof BaseEntity>;
          SET_FIELDS.forEach((f) => (fields[f] = s[f] ?? null));
          const set = upsert<PlanSet>(prevSet, fields);
          keptSets.add(set.id);
          if (set !== prevSet) await setStore.put(set);
        }
      }

      // Rows removed in the editor.
      for (const pe of oldPes) {
        for (const s of oldSetsByPe.get(pe.id) ?? []) if (!keptSets.has(s.id)) await setStore.delete(s.id);
        if (!keptPe.has(pe.id)) await peStore.delete(pe.id);
      }
      return plan.id;
    });
  },

  /** A copy for a new version of the program; history of the original stays with it. */
  async copy(id: Id): Promise<Id> {
    const full = await this.getFull(id);
    if (!full) throw new DomainError("План не найден");
    return this.save({
      name: `${full.plan.name} (копия)`,
      items: full.items.map((i) => ({
        exercise_id: i.exercise.id,
        note: i.planExercise.note,
        sets: i.sets.map(({ weight, reps, duration_sec, speed_kmh }) => ({ weight, reps, duration_sec, speed_kmh })),
        rest_set_sec: ownRest(i.planExercise),
        circuit_id: i.planExercise.circuit_id ?? null,
      })),
      rest: hasRestSettings(full.plan) ? restSettings(full.plan) : undefined,
      circuits: full.plan.circuits ? cleanCircuits(full.plan.circuits) : undefined,
    });
  },

  /** Applies the checked lines of «Обновить веса в плане?». Sets removed from the plan meanwhile are skipped. */
  async applySetUpdates(updates: { planSetId: Id; field: keyof SetValues; value: number | null }[]): Promise<number> {
    if (!updates.length) return 0;
    return withTx(["plan_sets"], "readwrite", async (tx) => {
      const store = tx.objectStore("plan_sets");
      const byId = new Map<Id, PlanSet>();
      for (const u of updates) {
        const current = byId.get(u.planSetId) ?? (await store.get(u.planSetId));
        if (!current) continue;
        byId.set(u.planSetId, { ...current, [u.field]: u.value });
      }
      for (const s of byId.values()) await store.put(touch(s, {}));
      return byId.size;
    });
  },

  /** «Обновить отдых в плане?» (stage 37): own rest between sets; the plan's own value clears it. */
  async applyRestUpdates(updates: { planExerciseId: Id; sec: number }[]): Promise<number> {
    if (!updates.length) return 0;
    return withTx(["plans", "plan_exercises"], "readwrite", async (tx) => {
      let n = 0;
      for (const u of updates) {
        const pe = await tx.objectStore("plan_exercises").get(u.planExerciseId);
        if (!pe) continue;
        const plan = await tx.objectStore("plans").get(pe.plan_id);
        const sec = cleanRest(u.sec);
        if (sec === null) continue;
        await tx.objectStore("plan_exercises").put(touch(pe, { rest_set_sec: sec === restSettings(plan).rest_set_sec ? null : sec }));
        n++;
      }
      return n;
    });
  },

  async archive(id: Id): Promise<void> {
    await setArchived(id, nowIso());
  },

  async restore(id: Id): Promise<void> {
    await setArchived(id, null);
  },
};

async function setArchived(id: Id, archived_at: string | null) {
  await withTx(["plans"], "readwrite", async (tx) => {
    const current = await tx.objectStore("plans").get(id);
    if (!current) throw new DomainError("План не найден");
    await tx.objectStore("plans").put(touch(current, { archived_at }));
  });
}
