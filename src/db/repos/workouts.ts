import { touch } from "@/domain/entity";
import { nowIso } from "@/domain/time";
import type { Exercise, Id, IsoDateTime, Plan, SetValues, Workout, WorkoutExercise, WorkoutSet } from "@/domain/types";
import { DomainError } from "@/domain/types";
import { buildWorkout, isStale, lastActivity, newWorkoutExercise, newWorkoutSet, type PlanSnapshotItem } from "@/domain/workout";
import { getDb, withTx } from "../client";

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

export const workoutsRepo = {
  /**
   * Starts a workout from a plan (or an empty one). Only one workout may be in progress:
   * the check and the creation happen in one transaction.
   */
  async start(planId: Id | null): Promise<StartResult> {
    return withTx(
      [...WORKOUT_STORES, "plans", "plan_exercises", "plan_sets", "exercises"],
      "readwrite",
      async (tx) => {
        const active = await tx.objectStore("workouts").index("status").get("in_progress");
        if (active) return { status: "conflict", active } as const;

        const items: PlanSnapshotItem[] = [];
        if (planId) {
          const plan = await tx.objectStore("plans").get(planId);
          if (!plan) throw new DomainError("План не найден");
          const pes = (await tx.objectStore("plan_exercises").index("plan_id").getAll(planId)).sort((a, b) => a.position - b.position);
          for (const pe of pes) {
            const [exercise, sets] = await Promise.all([
              tx.objectStore("exercises").get(pe.exercise_id),
              tx.objectStore("plan_sets").index("plan_exercise_id").getAll(pe.id),
            ]);
            if (exercise) items.push({ planExercise: pe, exercise, sets: sets.sort((a, b) => a.position - b.position) });
          }
        }
        const rec = buildWorkout(planId, items, nowIso());
        await tx.objectStore("workouts").put(rec.workout);
        await Promise.all(rec.exercises.map((r) => tx.objectStore("workout_exercises").put(r)));
        await Promise.all(rec.sets.map((r) => tx.objectStore("workout_sets").put(r)));
        return { status: "started", id: rec.workout.id } as const;
      },
    );
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
  async put(records: { workout?: Workout; exercises?: WorkoutExercise[]; sets?: WorkoutSet[]; deleteSetIds?: Id[] }): Promise<void> {
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      if (records.workout) await tx.objectStore("workouts").put(records.workout);
      for (const we of records.exercises ?? []) await tx.objectStore("workout_exercises").put(we);
      for (const s of records.sets ?? []) await tx.objectStore("workout_sets").put(s);
      for (const id of records.deleteSetIds ?? []) await tx.objectStore("workout_sets").delete(id);
    });
  },

  /** Adds an exercise at the end. Its sets start from last time's result, or one empty set. */
  async addExercise(workoutId: Id, exerciseId: Id): Promise<void> {
    const last = (await this.lastSetsByExercise([exerciseId], workoutId)).get(exerciseId);
    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const count = await tx.objectStore("workout_exercises").index("workout_id").count(workoutId);
      const we = newWorkoutExercise(workoutId, exerciseId, count);
      await tx.objectStore("workout_exercises").put(we);
      const values: SetValues[] = last?.length ? last : [{ weight: null, reps: null, duration_sec: null, speed_kmh: null }];
      for (const [i, v] of values.entries()) await tx.objectStore("workout_sets").put(newWorkoutSet(we.id, i, v));
    });
  },

  /**
   * Replaces the exercise for today only (PRD §3.4): the plan is untouched, history keeps "instead of".
   * Sets start from last time's result for the new exercise; without history — the current values
   * (same log type) or empty sets. Plan targets no longer apply to a replacement and are cleared.
   */
  async replaceExercise(workoutExerciseId: Id, exercise: Exercise): Promise<void> {
    const db = await getDb();
    const we = await db.get("workout_exercises", workoutExerciseId);
    if (!we) throw new DomainError("Упражнение не найдено");
    const old = await db.get("exercises", we.exercise_id);
    const last = (await this.lastSetsByExercise([exercise.id], we.workout_id)).get(exercise.id);

    await withTx([...WORKOUT_STORES], "readwrite", async (tx) => {
      const original = we.replaced_exercise_id ?? we.exercise_id;
      const updated = touch(we, {
        exercise_id: exercise.id,
        replaced_exercise_id: original === exercise.id ? null : original,
      });
      await tx.objectStore("workout_exercises").put(updated);

      const sets = (await tx.objectStore("workout_sets").index("workout_exercise_id").getAll(we.id)).sort((a, b) => a.position - b.position);
      const empty: SetValues = { weight: null, reps: null, duration_sec: null, speed_kmh: null };
      const values: SetValues[] = last?.length
        ? last
        : old?.log_type === exercise.log_type
          ? sets.map(({ weight, reps, duration_sec, speed_kmh }) => ({ weight, reps, duration_sec, speed_kmh }))
          : sets.map(() => empty);
      for (const s of sets) await tx.objectStore("workout_sets").delete(s.id);
      for (const [i, v] of values.entries()) await tx.objectStore("workout_sets").put(newWorkoutSet(we.id, i, v));
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

  /** Start time of the latest completed workout per plan (in-progress ones do not count). */
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
