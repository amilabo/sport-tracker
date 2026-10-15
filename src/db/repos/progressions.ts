import { newEntity, touch } from "@/domain/entity";
import { insertLevel, moveLevel } from "@/domain/progression";
import { cleanName, compareRu } from "@/domain/text";
import { DomainError, type Exercise, type Id, type Progression } from "@/domain/types";
import { getDb, withTx } from "../client";

export interface Chain {
  progression: Progression;
  /** Easiest first: index 0 is level 1. */
  members: Exercise[];
}

const STORES = ["progressions", "exercises"] as const;
const byLevel = (a: Exercise, b: Exercise) => (a.progression_level ?? 0) - (b.progression_level ?? 0);

export const progressionsRepo = {
  async chainOf(exerciseId: Id): Promise<Chain | null> {
    const db = await getDb();
    const exercise = await db.get("exercises", exerciseId);
    if (!exercise?.progression_id) return null;
    const progression = await db.get("progressions", exercise.progression_id);
    if (!progression) return null;
    const members = (await db.getAllFromIndex("exercises", "progression_id", progression.id)).sort(byLevel);
    return { progression, members };
  },

  async list(): Promise<Chain[]> {
    const db = await getDb();
    const [progressions, exercises] = await Promise.all([db.getAll("progressions"), db.getAll("exercises")]);
    return progressions
      .map((progression) => ({ progression, members: exercises.filter((e) => e.progression_id === progression.id).sort(byLevel) }))
      .sort((a, b) => compareRu(a.progression.name, b.progression.name));
  },

  /**
   * «Связать с вариантом»: `otherId` is easier or harder than `exerciseId`. Joins the chain one of them is in,
   * or starts a new chain named `name`. An exercise can be in one chain only (PRD §3.1.2).
   */
  async link(exerciseId: Id, otherId: Id, side: "easier" | "harder", name: string): Promise<void> {
    if (exerciseId === otherId) throw new DomainError("Выберите другое упражнение");
    await withTx([...STORES], "readwrite", async (tx) => {
      const exercises = tx.objectStore("exercises");
      const [current, other] = await Promise.all([exercises.get(exerciseId), exercises.get(otherId)]);
      if (!current || !other) throw new DomainError("Упражнение не найдено");
      const a = current.progression_id;
      const b = other.progression_id;
      if (a && a === b) throw new DomainError(`«${other.name}» уже в этой прогрессии`);
      if (a && b) {
        const theirs = await tx.objectStore("progressions").get(b);
        throw new DomainError(`«${other.name}» уже в прогрессии «${theirs?.name ?? ""}». Сначала исключите его оттуда.`);
      }

      let progressionId: Id;
      let order: Id[];
      if (a || b) {
        progressionId = (a ?? b)!;
        const members = (await exercises.index("progression_id").getAll(progressionId)).sort(byLevel).map((e) => e.id);
        // Put the newcomer next to the one already in the chain.
        order = a ? insertLevel(members, exerciseId, otherId, side) : insertLevel(members, otherId, exerciseId, side === "easier" ? "harder" : "easier");
      } else {
        const title = cleanName(name);
        if (!title) throw new DomainError("Введите название прогрессии");
        const progression: Progression = newEntity({ name: title });
        await tx.objectStore("progressions").put(progression);
        progressionId = progression.id;
        order = side === "easier" ? [otherId, exerciseId] : [exerciseId, otherId];
      }

      for (const [i, id] of order.entries()) {
        const e = id === exerciseId ? current : id === otherId ? other : await exercises.get(id);
        if (e && (e.progression_id !== progressionId || e.progression_level !== i + 1)) {
          await exercises.put(touch(e, { progression_id: progressionId, progression_level: i + 1 }));
        }
      }
    });
  },

  /** One level harder (+1) or easier (−1). */
  async move(exerciseId: Id, dir: 1 | -1): Promise<void> {
    await withTx(["exercises"], "readwrite", async (tx) => {
      const exercises = tx.objectStore("exercises");
      const e = await exercises.get(exerciseId);
      if (!e?.progression_id) return;
      const members = (await exercises.index("progression_id").getAll(e.progression_id)).sort(byLevel);
      const order = moveLevel(members.map((m) => m.id), exerciseId, dir);
      for (const m of members) {
        const level = order.indexOf(m.id) + 1;
        if (m.progression_level !== level) await exercises.put(touch(m, { progression_level: level }));
      }
    });
  },

  /** Takes the exercise out of its chain. A chain left with one exercise is dissolved. Workouts are not touched. */
  async exclude(exerciseId: Id): Promise<void> {
    await withTx([...STORES], "readwrite", async (tx) => {
      const exercises = tx.objectStore("exercises");
      const e = await exercises.get(exerciseId);
      if (!e?.progression_id) return;
      const progressionId = e.progression_id;
      const rest = (await exercises.index("progression_id").getAll(progressionId)).filter((m) => m.id !== exerciseId).sort(byLevel);
      await exercises.put(touch(e, { progression_id: null, progression_level: null }));
      if (rest.length < 2) {
        for (const m of rest) await exercises.put(touch(m, { progression_id: null, progression_level: null }));
        await tx.objectStore("progressions").delete(progressionId);
        return;
      }
      for (const [i, m] of rest.entries()) {
        if (m.progression_level !== i + 1) await exercises.put(touch(m, { progression_level: i + 1 }));
      }
    });
  },

  async rename(progressionId: Id, name: string): Promise<void> {
    const title = cleanName(name);
    if (!title) throw new DomainError("Введите название прогрессии");
    await withTx(["progressions"], "readwrite", async (tx) => {
      const p = await tx.objectStore("progressions").get(progressionId);
      if (p) await tx.objectStore("progressions").put(touch(p, { name: title }));
    });
  },
};
