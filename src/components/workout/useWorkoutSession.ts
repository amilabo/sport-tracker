"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { workoutsRepo, type WorkoutFull } from "@/db/repos/workouts";
import { touch } from "@/domain/entity";
import { nowIso } from "@/domain/time";
import type { Exercise, Id, SetValues, Workout, WorkoutExercise, WorkoutSet } from "@/domain/types";
import { isExerciseDone, isStale, newWorkoutSet, type SetField } from "@/domain/workout";

type Records = Parameters<typeof workoutsRepo.put>[0];
type Change = { next: WorkoutFull; records: Records };

interface Loaded {
  full: WorkoutFull | null;
  last: Map<Id, SetValues[]>;
}

async function load(id: Id): Promise<Loaded> {
  const full = (await workoutsRepo.getFull(id)) ?? null;
  const last = full
    ? await workoutsRepo.lastSetsByExercise([...new Set(full.items.map((i) => i.exercise.id))], id)
    : new Map<Id, SetValues[]>();
  return { full, last };
}

/**
 * The workout screen state. Every action updates the screen immediately and is written to IndexedDB
 * right away through a sequential queue (PRD §3.3 autosave); `savedAt` is set when the write commits.
 */
export function useWorkoutSession(id: Id) {
  const [full, setFull] = useState<WorkoutFull | null | "missing">(null);
  const [last, setLast] = useState<Map<Id, SetValues[]>>(new Map());
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const current = useRef<WorkoutFull | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const applyLoaded = useCallback((loaded: Loaded) => {
    current.current = loaded.full;
    setFull(loaded.full ?? "missing");
    setLast(loaded.last);
    // Everything on screen is already stored: show when it was last written.
    if (loaded.full) {
      const { workout, items } = loaded.full;
      const latest = [workout.updated_at, ...items.flatMap((i) => [i.we.updated_at, ...i.sets.map((s) => s.updated_at)])].sort().at(-1)!;
      setSavedAt((prev) => prev ?? new Date(latest));
    }
  }, []);

  const reload = useCallback(async () => applyLoaded(await load(id)), [id, applyLoaded]);

  useEffect(() => {
    let alive = true;
    load(id).then((loaded) => alive && applyLoaded(loaded));
    return () => {
      alive = false;
    };
  }, [id, applyLoaded]);

  // Screen left open overnight: the workout is finished automatically — reload instead of writing on top of it.
  useEffect(() => {
    const onVisible = async () => {
      const cur = current.current;
      if (document.visibilityState !== "visible" || !cur || !isStale(cur.workout)) return;
      await queue.current;
      await workoutsRepo.autoFinishStale();
      await reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const persist = useCallback((records: Records) => {
    queue.current = queue.current
      .then(() => workoutsRepo.put(records))
      .then(
        () => {
          setSavedAt(new Date());
          setSaveFailed(false);
        },
        (err) => {
          console.error(err);
          setSaveFailed(true);
        },
      );
    return queue.current;
  }, []);

  const apply = useCallback(
    (fn: (f: WorkoutFull) => Change | null) => {
      const cur = current.current;
      if (!cur) return;
      const change = fn(cur);
      if (!change) return;
      current.current = change.next;
      setFull(change.next);
      persist(change.records);
    },
    [persist],
  );

  /** Replaces item `index` (its we and sets) and records what to write. */
  const withItem = (f: WorkoutFull, index: number, we: WorkoutExercise, sets: WorkoutSet[], records: Records): Change => ({
    next: { ...f, items: f.items.map((it, i) => (i === index ? { ...it, we, sets } : it)) },
    records,
  });

  const actions = {
    /** ✓ on the card: all sets done with their current values; a second tap undoes. */
    toggleExercise: (index: number) =>
      apply((f) => {
        const item = f.items[index];
        if (!item.sets.length) return null;
        const done = isExerciseDone(item.sets);
        const at = nowIso();
        const sets = item.sets.map((s) => (done ? touch(s, { done_at: null }) : s.done_at ? s : touch(s, { done_at: at })));
        return withItem(f, index, item.we, sets, { sets: sets.filter((s, i) => s !== item.sets[i]) });
      }),

    toggleSet: (index: number, setIndex: number) =>
      apply((f) => {
        const item = f.items[index];
        const s = item.sets[setIndex];
        const updated = touch(s, { done_at: s.done_at ? null : nowIso() });
        const sets = item.sets.map((x, i) => (i === setIndex ? updated : x));
        return withItem(f, index, item.we, sets, { sets: [updated] });
      }),

    setValue: (index: number, setIndex: number, field: SetField, value: number | null) =>
      apply((f) => {
        const item = f.items[index];
        const s = item.sets[setIndex];
        if (s[field] === value) return null;
        const updated = touch(s, { [field]: value } as Partial<WorkoutSet>);
        const sets = item.sets.map((x, i) => (i === setIndex ? updated : x));
        return withItem(f, index, item.we, sets, { sets: [updated] });
      }),

    /** New set always goes last, as a copy of the previous one (PRD §3.3). */
    addSet: (index: number) =>
      apply((f) => {
        const item = f.items[index];
        const prev = item.sets.at(-1);
        const values: SetValues = prev
          ? { weight: prev.weight, reps: prev.reps, duration_sec: prev.duration_sec, speed_kmh: prev.speed_kmh }
          : { weight: null, reps: null, duration_sec: null, speed_kmh: null };
        const added = newWorkoutSet(item.we.id, item.sets.length, values);
        return withItem(f, index, item.we, [...item.sets, added], { sets: [added] });
      }),

    removeLastSet: (index: number) =>
      apply((f) => {
        const item = f.items[index];
        const removed = item.sets.at(-1);
        if (!removed || item.sets.length <= 1) return null;
        return withItem(f, index, item.we, item.sets.slice(0, -1), { deleteSetIds: [removed.id] });
      }),

    setSkipped: (index: number, skipped: boolean) =>
      apply((f) => {
        const item = f.items[index];
        const we = touch(item.we, { skipped });
        return withItem(f, index, we, item.sets, { exercises: [we] });
      }),

    setNote: (index: number, note: string | null) =>
      apply((f) => {
        const item = f.items[index];
        const we = touch(item.we, { note });
        return withItem(f, index, we, item.sets, { exercises: [we] });
      }),

    move: (index: number, dir: -1 | 1) =>
      apply((f) => {
        const to = index + dir;
        if (to < 0 || to >= f.items.length) return null;
        const items = f.items.slice();
        [items[index], items[to]] = [items[to], items[index]];
        const changed: WorkoutExercise[] = [];
        const next = items.map((it, i) => {
          if (it.we.position === i) return it;
          const we = touch(it.we, { position: i });
          changed.push(we);
          return { ...it, we };
        });
        return { next: { ...f, items: next }, records: { exercises: changed } };
      }),

    setWorkout: (patch: Partial<Pick<Workout, "wellbeing_before" | "mood_before" | "note">>) =>
      apply((f) => {
        const workout = touch(f.workout, patch);
        return { next: { ...f, workout }, records: { workout } };
      }),

    addExercise: async (exercise: Exercise) => {
      await queue.current;
      await workoutsRepo.addExercise(id, exercise.id);
      setSavedAt(new Date());
      await reload();
    },

    replaceExercise: async (index: number, exercise: Exercise) => {
      const cur = current.current;
      if (!cur) return;
      await queue.current;
      await workoutsRepo.replaceExercise(cur.items[index].we.id, exercise);
      setSavedAt(new Date());
      await reload();
    },

    /** Waits for pending writes (before leaving the screen). */
    flush: () => queue.current,
  };

  return { full, last, savedAt, saveFailed, actions };
}
