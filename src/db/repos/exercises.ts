import { newEntity, touch } from "@/domain/entity";
import { cleanDescription, cleanName, compareRu, searchKey } from "@/domain/text";
import { nowIso } from "@/domain/time";
import { DomainError, type Equipment, type Exercise, type Id, type LogType, type MuscleGroup, type Plan } from "@/domain/types";
import { getDb, withTx } from "../client";

export interface ExerciseInput {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  log_type: LogType;
  /** «Как делать» of an own exercise; ignored for catalog ones (their text ships with the app). */
  description?: string | null;
}

function assertName(name: string) {
  if (!name) throw new DomainError("Введите название упражнения");
}

function sameName(all: Exercise[], name: string, exceptId?: Id) {
  const key = searchKey(name);
  return all.find((e) => e.id !== exceptId && !e.archived_at && searchKey(e.name) === key);
}

export const exercisesRepo = {
  async list({ includeArchived = false } = {}): Promise<Exercise[]> {
    const all = await (await getDb()).getAll("exercises");
    return all.filter((e) => includeArchived || !e.archived_at).sort((a, b) => compareRu(a.name, b.name));
  },

  async listArchived(): Promise<Exercise[]> {
    const all = await (await getDb()).getAll("exercises");
    return all.filter((e) => e.archived_at).sort((a, b) => compareRu(a.name, b.name));
  },

  async get(id: Id): Promise<Exercise | undefined> {
    return (await getDb()).get("exercises", id);
  },

  async create(input: ExerciseInput): Promise<Exercise> {
    const name = cleanName(input.name);
    assertName(name);
    return withTx(["exercises"], "readwrite", async (tx) => {
      const store = tx.objectStore("exercises");
      const twin = sameName(await store.getAll(), name);
      if (twin) throw new DomainError(`Упражнение «${twin.name}» уже есть в каталоге`);
      const exercise: Exercise = newEntity({
        name,
        muscle_group: input.muscle_group,
        equipment: input.equipment,
        log_type: input.log_type,
        is_builtin: false,
        archived_at: null,
        progression_id: null,
        progression_level: null,
        description: cleanDescription(input.description),
      });
      await store.put(exercise);
      return exercise;
    });
  },

  /** Rename and other edits apply everywhere: plans and history reference the exercise by id. */
  async update(id: Id, patch: Partial<ExerciseInput>): Promise<Exercise> {
    return withTx(["exercises", "workout_exercises"], "readwrite", async (tx) => {
      const store = tx.objectStore("exercises");
      const current = await store.get(id);
      if (!current) throw new DomainError("Упражнение не найдено");

      const next: Partial<ExerciseInput> = { ...patch };
      if (patch.description !== undefined) {
        if (current.is_builtin) delete next.description;
        else next.description = cleanDescription(patch.description);
      }
      if (patch.name !== undefined) {
        next.name = cleanName(patch.name);
        assertName(next.name);
        const twin = sameName(await store.getAll(), next.name, id);
        if (twin) throw new DomainError(`Упражнение «${twin.name}» уже есть в каталоге`);
      }
      if (patch.log_type !== undefined && patch.log_type !== current.log_type) {
        const used = await tx.objectStore("workout_exercises").index("exercise_id").count(id);
        if (used > 0) throw new DomainError("Тип записи нельзя изменить: по упражнению уже есть история");
      }
      const updated = touch(current, next);
      await store.put(updated);
      return updated;
    });
  },

  async archive(id: Id): Promise<void> {
    await setArchived(id, nowIso());
  },

  async restore(id: Id): Promise<void> {
    await setArchived(id, null);
  },

  /** Active (not archived) plans that contain the exercise — for the archive warning. */
  async usedInPlans(id: Id): Promise<Plan[]> {
    return withTx(["plan_exercises", "plans"], "readonly", async (tx) => {
      const links = await tx.objectStore("plan_exercises").index("exercise_id").getAll(id);
      const planIds = [...new Set(links.map((l) => l.plan_id))];
      const plans = await Promise.all(planIds.map((pid) => tx.objectStore("plans").get(pid)));
      return plans.filter((p): p is Plan => !!p && !p.archived_at).sort((a, b) => compareRu(a.name, b.name));
    });
  },

  async hasHistory(id: Id): Promise<boolean> {
    return (await (await getDb()).countFromIndex("workout_exercises", "exercise_id", id)) > 0;
  },
};

async function setArchived(id: Id, archived_at: string | null) {
  await withTx(["exercises"], "readwrite", async (tx) => {
    const store = tx.objectStore("exercises");
    const current = await store.get(id);
    if (!current) throw new DomainError("Упражнение не найдено");
    if (archived_at === null && sameName(await store.getAll(), current.name, id)) {
      throw new DomainError(`В каталоге уже есть упражнение «${current.name}» — переименуйте одно из них`);
    }
    await store.put(touch(current, { archived_at }));
  });
}
