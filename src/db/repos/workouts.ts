import { touch } from "@/domain/entity";
import type { ExerciseSession } from "@/domain/chart-series";
import type { HistoryEntry } from "@/domain/history";
import { summarize } from "@/domain/summary";
import { nowIso } from "@/domain/time";
import type { Exercise, Id, IsoDateTime, Plan, SetValues, Workout, WorkoutExercise, WorkoutSet } from "@/domain/types";
import { DomainError } from "@/domain/types";
import { addedExercise, buildWorkout, isStale, lastActivity, replacedExercise, type PlanSnapshotItem } from "@/domain/workout";
import type { IDBPTransaction } from "idb";
import { getDb, withTx } from "../client";
import type { TrackerDB } from "../schema";

export interface WorkoutItem {
  we: WorkoutExercise;
  exercise: Exercise;
  /** The exercise it replaced today, if any. */
  replaced: Exercise | null;
  /** Note from the plan ("на каждую ногу по 10 раз"). */
  planNote: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutFull {
  workout: Workout;
  plan: Plan | null;
  items: WorkoutItem[];
}

export type StartResult = { status: "started"; id: Id } | { status: "conflict"; active: Workout };

const WORKOUT_STORES = ["workouts", "workout_exercises", "workout_sets"] as const;
const COMPLETED = new Set<Workout["status"]>(["finished", "auto_finished"]);
const PLAN_STORES = ["plans", "plan_exercises", "plan_sets", "exercises"] as const;

type PlanReadTx = IDBPTransaction<TrackerDB, (typeof PLAN_STORES)[number][], "readonly" | "readwrite">;

/** The plan with its exercises and sets in order — what a new workout copies. */
async function readPlanSnapshot(tx: PlanReadTx, planId: Id): Promise<{ plan: Plan; items: PlanSnapshotItem[] }> {
  const plan = await tx.objectStore("plans").get(planId);
  if (!plan) throw new DomainError("План не найден");
  const pes = (await tx.objectStore("plan_exercises").index("plan_id").getAll(planId)).sort((a, b) => a.position - b.position);
  const items: PlanSnapshotItem[] = [];
  for (const pe of pes) {
    const [exercise, sets] = await Promise.all([
      tx.objectStore("exercises").get(pe.exercise_id),
      tx.objectStore("plan_sets").index("plan_exercise_id").getAll(pe.id),
    ]);
    if (exercise) items.push({ planExercise: pe, exercise, sets: sets.sort((a, b) => a.position - b.position) });
  }
  return { plan, items };
}

export const workoutsRepo = {
  /**
   * Starts a workout from a plan (or an empty one). Only one workout may be in progress:
   * the check and the creation happen in one transaction.
   */
  async start(planId: Id | null): Promise<StartResult> {
    return withTx(
      [...WORKOUT_STORES, ...PLAN_STORES],
      "readwrite",
      async (tx) => {
        const active = await tx.objectStore("workouts").index("status").get("in_progress");
        if (active) return { status: "conflict", active } as const;
        // The transaction covers the plan stores too; idb's types cannot narrow it to them.
        const items = planId ? (await readPlanSnapshot(tx as unknown as PlanReadTx, planId)).items : [];
        const rec = buildWorkout(planId, items, nowIso());
        await tx.objectStore("workouts").put(rec.workout);
        await Promise.all(rec.exercises.map((r) => tx.objectStore("workout_exercises").put(r)));
        await Promise.all(rec.sets.map((r) => tx.objectStore("workout_sets").put(r)));
        return { status: "started", id: rec.workout.id } as const;
      },
    );
  },

  /**
   * A workout from the plan that is not started yet and is not stored: the screen before "Начать".
   * Changes for today are made on it in memory; `startDraft` writes it. `null` — an empty workout without a plan.
   */
  async draft(planId: Id | null): Promise<WorkoutFull> {
    if (planId === null) return { workout: buildWorkout(null, [], nowIso()).workout, plan: null, items: [] };
    return withTx([...PLAN_STORES], "readonly", async (tx) => {
      const { plan, items } = await readPlanSnapshot(tx, planId);
      const rec = buildWorkout(planId, items, nowIso());
      return {
        workout: rec.workout,
        plan,
        items: rec.exercises.map((we, i) => ({
          we,
          exercise: items[i].exercise,
          replaced: null,
          planNote: items[i].planExercise.note,
          sets: rec.sets.filter((s) => s.workout_exercise_id === we.id),
        })),
      };
    });
  },

  /** Starts a draft as it is now (with today's changes), the start time is now. Same one-in-progress rule. */
  async startDraft(full: WorkoutFull): Promise<StartResult> {
    return withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const active = await tx.objectStore("workouts").index("status").get("in_progress");
      if (active) return { status: "conflict", active } as const;
      const at = nowIso();
      await tx.objectStore("workouts").put({ ...full.workout, started_at: at, created_at: at, updated_at: at });
      for (const item of full.items) {
        await tx.objectStore("workout_exercises").put(item.we);
        for (const s of item.sets) await tx.objectStore("workout_sets").put(s);
      }
      return { status: "started", id: full.workout.id } as const;
    });
  },

  async getActive(): Promise<Workout | undefined> {
    return (await getDb()).getFromIndex("workouts", "status", "in_progress");
  },

  async get(id: Id): Promise<Workout | undefined> {
    return (await getDb()).get("workouts", id);
  },

  async getFull(id: Id): Promise<WorkoutFull | undefined> {
    return withTx([...WORKOUT_STORES, "plans", "plan_exercises", "exercises"], "readonly", async (tx) => {
      const workout = await tx.objectStore("workouts").get(id);
      if (!workout) return undefined;
      const plan = workout.plan_id ? ((await tx.objectStore("plans").get(workout.plan_id)) ?? null) : null;
      const wes = (await tx.objectStore("workout_exercises").index("workout_id").getAll(id)).sort((a, b) => a.position - b.position);
      const items = await Promise.all(
        wes.map(async (we) => {
          const [exercise, replaced, pe, sets] = await Promise.all([
            tx.objectStore("exercises").get(we.exercise_id),
            we.replaced_exercise_id ? tx.objectStore("exercises").get(we.replaced_exercise_id) : Promise.resolve(undefined),
            we.plan_exercise_id ? tx.objectStore("plan_exercises").get(we.plan_exercise_id) : Promise.resolve(undefined),
            tx.objectStore("workout_sets").index("workout_exercise_id").getAll(we.id),
          ]);
          if (!exercise) return null;
          return {
            we,
            exercise,
            replaced: replaced ?? null,
            planNote: pe?.note ?? null,
            sets: sets.sort((a, b) => a.position - b.position),
          };
        }),
      );
      return { workout, plan, items: items.filter((i): i is WorkoutItem => i !== null) };
    });
  },

  /** Writes records already updated in the UI (sets, workout exercises, the workout) in one transaction. */
  async put(records: {
    workout?: Workout;
    exercises?: WorkoutExercise[];
    sets?: WorkoutSet[];
    deleteSetIds?: Id[];
    /** Workout exercises to delete together with their sets. */
    deleteExerciseIds?: Id[];
  }): Promise<void> {
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      if (records.workout) await tx.objectStore("workouts").put(records.workout);
      for (const we of records.exercises ?? []) await tx.objectStore("workout_exercises").put(we);
      for (const s of records.sets ?? []) await tx.objectStore("workout_sets").put(s);
      for (const id of records.deleteSetIds ?? []) await tx.objectStore("workout_sets").delete(id);
      for (const id of records.deleteExerciseIds ?? []) {
        const setIds = await tx.objectStore("workout_sets").index("workout_exercise_id").getAllKeys(id);
        for (const setId of setIds) await tx.objectStore("workout_sets").delete(setId);
        await tx.objectStore("workout_exercises").delete(id);
      }
    });
  },

  /** Adds an exercise at the end. Its sets start from last time's result, or one empty set. */
  async addExercise(workoutId: Id, exerciseId: Id): Promise<void> {
    const last = (await this.lastSetsByExercise([exerciseId], workoutId)).get(exerciseId);
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const count = await tx.objectStore("workout_exercises").index("workout_id").count(workoutId);
      const added = addedExercise(workoutId, exerciseId, count, last);
      await tx.objectStore("workout_exercises").put(added.we);
      for (const s of added.sets) await tx.objectStore("workout_sets").put(s);
    });
  },

  /** Replaces the exercise for today only — see `replacedExercise`. */
  async replaceExercise(workoutExerciseId: Id, exercise: Exercise): Promise<void> {
    const db = await getDb();
    const we = await db.get("workout_exercises", workoutExerciseId);
    if (!we) throw new DomainError("Упражнение не найдено");
    const old = await db.get("exercises", we.exercise_id);
    const last = (await this.lastSetsByExercise([exercise.id], we.workout_id)).get(exercise.id);

    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const sets = (await tx.objectStore("workout_sets").index("workout_exercise_id").getAll(we.id)).sort((a, b) => a.position - b.position);
      const next = replacedExercise(we, old?.log_type, sets, exercise, last);
      await tx.objectStore("workout_exercises").put(next.we);
      for (const s of sets) await tx.objectStore("workout_sets").delete(s.id);
      for (const s of next.sets) await tx.objectStore("workout_sets").put(s);
    });
  },

  /**
   * Result of the latest completed workout with each exercise (done sets, in order) — for "в прошлый раз"
   * and for pre-filling an exercise added on the fly.
   */
  async lastSetsByExercise(exerciseIds: Id[], excludeWorkoutId?: Id): Promise<Map<Id, SetValues[]>> {
    const result = new Map<Id, SetValues[]>();
    await withTx([...WORKOUT_STORES], "readonly", async (tx) => {
      for (const exId of exerciseIds) {
        const wes = await tx.objectStore("workout_exercises").index("exercise_id").getAll(exId);
        let best: { started: IsoDateTime; weId: Id } | null = null;
        for (const we of wes) {
          if (we.workout_id === excludeWorkoutId) continue;
          const w = await tx.objectStore("workouts").get(we.workout_id);
          if (!w || !COMPLETED.has(w.status)) continue;
          if (!best || w.started_at > best.started) best = { started: w.started_at, weId: we.id };
        }
        if (!best) continue;
        const sets = (await tx.objectStore("workout_sets").index("workout_exercise_id").getAll(best.weId))
          .filter((s) => s.done_at)
          .sort((a, b) => a.position - b.position)
          .map(({ weight, reps, duration_sec, speed_kmh }) => ({ weight, reps, duration_sec, speed_kmh }));
        if (sets.length) result.set(exId, sets);
      }
    });
    return result;
  },

  /** Finishes a workout now (or at `finishedAt`). The "update plan weights?" prompt is still pending. */
  async finish(id: Id, finishedAt: IsoDateTime = nowIso()): Promise<void> {
    await withTx(["workouts"], "readwrite", async (tx) => {
      const w = await tx.objectStore("workouts").get(id);
      if (!w) throw new DomainError("Тренировка не найдена");
      if (w.status !== "in_progress") return;
      await tx.objectStore("workouts").put(touch(w, { status: "finished", finished_at: finishedAt }));
    });
  },

  /**
   * Saves a finished workout from the finish screen (PRD §3.5): times as corrected by the user,
   * "after" ratings and note. The plan question is answered on this screen, so it is not asked again.
   */
  async complete(
    id: Id,
    data: Pick<Workout, "started_at" | "finished_at" | "energy_after" | "mood_after" | "note">,
  ): Promise<void> {
    await withTx(["workouts"], "readwrite", async (tx) => {
      const w = await tx.objectStore("workouts").get(id);
      if (!w) throw new DomainError("Тренировка не найдена");
      const status = w.status === "in_progress" ? "finished" : w.status;
      await tx.objectStore("workouts").put(touch(w, { ...data, status, plan_update_prompted: true }));
    });
  },

  async markPlanPrompted(id: Id): Promise<void> {
    await withTx(["workouts"], "readwrite", async (tx) => {
      const w = await tx.objectStore("workouts").get(id);
      if (w && !w.plan_update_prompted) await tx.objectStore("workouts").put(touch(w, { plan_update_prompted: true }));
    });
  },

  /** A completed plan workout whose «Обновить веса в плане?» was not asked yet (e.g. finished automatically). */
  async pendingPlanPrompt(): Promise<Workout | undefined> {
    const all = await (await getDb()).getAll("workouts");
    return all
      .filter((w) => COMPLETED.has(w.status) && !w.plan_update_prompted)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  },

  /** Workouts left in progress on an earlier day become "finished automatically" (PRD §3.13). */
  async autoFinishStale(now: Date = new Date()): Promise<Id[]> {
    const db = await getDb();
    const active = await db.getAllFromIndex("workouts", "status", "in_progress");
    const stale = active.filter((w) => isStale(w, now));
    if (!stale.length) return [];
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      for (const w of stale) {
        const wes = await tx.objectStore("workout_exercises").index("workout_id").getAll(w.id);
        const sets = (await Promise.all(wes.map((we) => tx.objectStore("workout_sets").index("workout_exercise_id").getAll(we.id)))).flat();
        await tx.objectStore("workouts").put(touch(w, { status: "auto_finished", finished_at: lastActivity(w, sets) }));
      }
    });
    return stale.map((w) => w.id);
  },

  /** Finished workouts (in-progress ones are on the home screen) with their summary, for the history feed. */
  async listHistory(): Promise<HistoryEntry[]> {
    return withTx([...WORKOUT_STORES, "plans", "exercises"], "readonly", async (tx) => {
      const [workouts, wes, sets, exercises, plans] = await Promise.all([
        tx.objectStore("workouts").getAll(),
        tx.objectStore("workout_exercises").getAll(),
        tx.objectStore("workout_sets").getAll(),
        tx.objectStore("exercises").getAll(),
        tx.objectStore("plans").getAll(),
      ]);
      const exById = new Map(exercises.map((e) => [e.id, e]));
      const planById = new Map(plans.map((p) => [p.id, p]));
      const setsByWe = new Map<Id, WorkoutSet[]>();
      for (const set of sets) setsByWe.set(set.workout_exercise_id, [...(setsByWe.get(set.workout_exercise_id) ?? []), set]);
      const wesByWorkout = new Map<Id, WorkoutExercise[]>();
      for (const we of wes) wesByWorkout.set(we.workout_id, [...(wesByWorkout.get(we.workout_id) ?? []), we]);

      return workouts
        .filter((w) => COMPLETED.has(w.status))
        .map((workout) => {
          const items = (wesByWorkout.get(workout.id) ?? [])
            .sort((a, b) => a.position - b.position)
            .flatMap((we) => {
              const exercise = exById.get(we.exercise_id);
              if (!exercise) return [];
              const replaced = we.replaced_exercise_id ? (exById.get(we.replaced_exercise_id) ?? null) : null;
              return [{ we, exercise, replaced, sets: setsByWe.get(we.id) ?? [] }];
            });
          return {
            workout,
            planName: workout.plan_id ? (planById.get(workout.plan_id)?.name ?? null) : null,
            summary: summarize(items),
          };
        });
    });
  },

  /** Every finished workout where these exercises were done (a replacement counts for the exercise done), newest first. */
  async exerciseSessions(exerciseIds: Id[]): Promise<(ExerciseSession & { exerciseId: Id })[]> {
    return withTx([...WORKOUT_STORES], "readonly", async (tx) => {
      const out: (ExerciseSession & { exerciseId: Id })[] = [];
      for (const exerciseId of exerciseIds) {
        const wes = await tx.objectStore("workout_exercises").index("exercise_id").getAll(exerciseId);
        for (const we of wes) {
          const workout = await tx.objectStore("workouts").get(we.workout_id);
          if (!workout || !COMPLETED.has(workout.status)) continue;
          const sets = (await tx.objectStore("workout_sets").index("workout_exercise_id").getAll(we.id)).sort((a, b) => a.position - b.position);
          out.push({ workoutId: workout.id, startedAt: workout.started_at, sets, exerciseId });
        }
      }
      return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    });
  },

  /** Deletes a workout with all its exercises and sets, in one transaction. */
  async remove(id: Id): Promise<void> {
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const wes = await tx.objectStore("workout_exercises").index("workout_id").getAll(id);
      for (const we of wes) {
        const setIds = await tx.objectStore("workout_sets").index("workout_exercise_id").getAllKeys(we.id);
        for (const setId of setIds) await tx.objectStore("workout_sets").delete(setId);
        await tx.objectStore("workout_exercises").delete(we.id);
      }
      await tx.objectStore("workouts").delete(id);
    });
  },

  /** Start time of the latest completed workout per plan (in-progress ones do not count). */
  /** Completed workouts by one plan: how many and the latest start (archived plan view). */
  async planStats(planId: Id): Promise<{ count: number; last: IsoDateTime | null }> {
    const done = (await (await getDb()).getAllFromIndex("workouts", "plan_id", planId)).filter((w) => COMPLETED.has(w.status));
    return { count: done.length, last: done.reduce<IsoDateTime | null>((acc, w) => (!acc || w.started_at > acc ? w.started_at : acc), null) };
  },

  async lastStartedByPlan(): Promise<Map<Id, IsoDateTime>> {
    const all = await (await getDb()).getAll("workouts");
    const last = new Map<Id, IsoDateTime>();
    for (const w of all) {
      if (!w.plan_id || !COMPLETED.has(w.status)) continue;
      const prev = last.get(w.plan_id);
      if (!prev || w.started_at > prev) last.set(w.plan_id, w.started_at);
    }
    return last;
  },
};
