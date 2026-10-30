import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BACKUP_FORMAT, parseBackup } from "@/domain/backup";
import { resetDbForTests } from "./client";
import { backupRepo } from "./repos/backup";
import { plansRepo } from "./repos/plans";
import { workoutsRepo } from "./repos/workouts";
import { DB_VERSION } from "./schema";
import { exerciseSeedId, planSeedId } from "./seed";

const LEGS = planSeedId("plan_legs_chest_arms");
const bench = exerciseSeedId("bench_press");
const squat = exerciseSeedId("barbell_squat");
const sets = (n: number) => Array.from({ length: n }, () => ({ weight: 24, reps: 10, duration_sec: null, speed_kmh: null }));
const REST = { format: "rest" as const, rest_set_sec: 90, rest_exercise_sec: 180 };

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

async function started(planId: string) {
  const r = await workoutsRepo.start(planId);
  if (r.status !== "started") throw new Error("expected start");
  return (await workoutsRepo.getFull(r.id))!;
}

describe("plans with rest (stage 34)", () => {
  it("a plan saved without rest has no rest fields at all — as before stage 34", async () => {
    const id = await plansRepo.save({ name: "Силовая", items: [{ exercise_id: squat, note: null, sets: sets(3) }] });
    const full = (await plansRepo.getFull(id))!;
    expect("format" in full.plan).toBe(false);
    expect("rest_set_sec" in full.items[0].planExercise).toBe(false);
  });

  it("re-saving an old plan without changes keeps its record untouched", async () => {
    const before = (await plansRepo.getFull(LEGS))!;
    await plansRepo.save({
      id: LEGS,
      name: before.plan.name,
      items: before.items.map((i) => ({ id: i.planExercise.id, exercise_id: i.exercise.id, note: i.planExercise.note, sets: i.sets, rest_set_sec: null })),
    });
    const after = (await plansRepo.getFull(LEGS))!;
    expect(after.plan.updated_at).toBe(before.plan.updated_at);
    expect(after.items.map((i) => i.planExercise.updated_at)).toEqual(before.items.map((i) => i.planExercise.updated_at));
  });

  it("stores type, defaults and an exercise's own rest; the copy keeps them", async () => {
    const id = await plansRepo.save({
      name: "Гири",
      rest: REST,
      items: [
        { exercise_id: bench, note: null, sets: sets(3), rest_set_sec: 120 },
        { exercise_id: squat, note: null, sets: sets(3) },
      ],
    });
    const full = (await plansRepo.getFull(id))!;
    expect(full.plan).toMatchObject(REST);
    expect(full.items.map((i) => i.planExercise.rest_set_sec ?? null)).toEqual([120, null]);

    const copy = (await plansRepo.getFull(await plansRepo.copy(id)))!;
    expect(copy.plan).toMatchObject(REST);
    expect(copy.items.map((i) => i.planExercise.rest_set_sec ?? null)).toEqual([120, null]);
  });

  it("switching back to «Силовая» keeps the rest values in the record", async () => {
    const id = await plansRepo.save({ name: "Гири", rest: REST, items: [{ exercise_id: squat, note: null, sets: sets(2) }] });
    await plansRepo.save({ id, name: "Гири", rest: { ...REST, format: "strength" }, items: [{ exercise_id: squat, note: null, sets: sets(2) }] });
    expect((await plansRepo.get(id))!).toMatchObject({ format: "strength", rest_set_sec: 90, rest_exercise_sec: 180 });
  });

  it("a workout keeps a snapshot of the rest settings; a «Силовая» workout keeps none", async () => {
    const id = await plansRepo.save({
      name: "Гири",
      rest: REST,
      items: [{ exercise_id: bench, note: null, sets: sets(3), rest_set_sec: 120 }, { exercise_id: squat, note: null, sets: sets(3) }],
    });
    const full = await started(id);
    expect(full.workout.rest).toEqual(REST);
    expect(full.items.map((i) => i.we.rest_set_sec ?? null)).toEqual([120, null]);

    // Plan edits after the start do not touch the running workout.
    await plansRepo.save({ id, name: "Гири", rest: { ...REST, rest_set_sec: 30 }, items: [{ exercise_id: squat, note: null, sets: sets(1) }] });
    expect((await workoutsRepo.getFull(full.workout.id))!.workout.rest).toEqual(REST);
    await workoutsRepo.finish(full.workout.id);

    const plain = await started(LEGS);
    expect("rest" in plain.workout).toBe(false);
    expect(plain.items.some((i) => "rest_set_sec" in i.we)).toBe(false);
  });

  it("the draft before «Начать» carries the snapshot too", async () => {
    const id = await plansRepo.save({ name: "Гири", rest: REST, items: [{ exercise_id: squat, note: null, sets: sets(2) }] });
    expect((await workoutsRepo.draft(id)).workout.rest).toEqual(REST);
  });
});

describe("rollback safety", () => {
  // An older app version cannot open a newer IndexedDB version and rejects a newer backup format.
  // Both must stay put so the site can be rolled back to the `before-rest` tag without losing data.
  it("keeps the IndexedDB version and the backup format", () => {
    expect(DB_VERSION).toBe(1);
    expect(BACKUP_FORMAT).toBe(1);
  });

  it("a backup with rest data restores as is", async () => {
    const id = await plansRepo.save({ name: "Гири", rest: REST, items: [{ exercise_id: bench, note: null, sets: sets(2), rest_set_sec: 45 }] });
    const file = parseBackup(JSON.stringify(await backupRepo.exportAll()));
    expect(file.schema_version).toBe(2);
    await resetDbForTests();
    await backupRepo.import(file, "replace");
    const full = (await plansRepo.getFull(id))!;
    expect(full.plan).toMatchObject(REST);
    expect(full.items[0].planExercise.rest_set_sec).toBe(45);
  });
});

describe("circuits (stage 36)", () => {
  const C = { id: "g1", rounds: 2, rest_inside_sec: 15, rest_round_sec: 60 };

  it("a group of «С отдыхом» is saved, copied and goes into the workout snapshot", async () => {
    const id = await plansRepo.save({
      name: "Круг",
      rest: REST,
      circuits: [C, { id: "unused", rounds: 3, rest_inside_sec: 0, rest_round_sec: 0 }],
      items: [
        { exercise_id: squat, note: null, sets: sets(2), circuit_id: "g1" },
        { exercise_id: bench, note: null, sets: sets(2), circuit_id: "g1" },
        { exercise_id: exerciseSeedId("forearm_plank"), note: null, sets: sets(1) },
      ],
    });
    const full = (await plansRepo.getFull(id))!;
    expect(full.plan.circuits).toEqual([C]);
    expect(full.items.map((i) => i.planExercise.circuit_id ?? null)).toEqual(["g1", "g1", null]);

    const copy = (await plansRepo.getFull(await plansRepo.copy(id)))!;
    expect(copy.plan.circuits).toEqual([C]);

    const w = await started(id);
    expect(w.workout.rest?.circuits).toEqual([C]);
    expect(w.items.map((i) => i.we.circuit_id ?? null)).toEqual(["g1", "g1", null]);
  });

  it("«Круговая» puts every exercise into the whole-plan circuit", async () => {
    const id = await plansRepo.save({
      name: "Круговая",
      rest: { ...REST, format: "circuit" },
      circuits: [{ id: "all", rounds: 2, rest_inside_sec: 10, rest_round_sec: 90 }],
      items: [
        { exercise_id: squat, note: null, sets: sets(2) },
        { exercise_id: bench, note: null, sets: sets(2) },
      ],
    });
    const w = await started(id);
    expect(w.workout.rest?.circuits?.map((c) => c.id)).toEqual(["all"]);
    expect(w.items.every((i) => i.we.circuit_id === "all")).toBe(true);
  });

  it("circuits are kept but not used in «Силовая»", async () => {
    const id = await plansRepo.save({
      name: "Был круг",
      rest: { ...REST, format: "strength" },
      circuits: [C],
      items: [
        { exercise_id: squat, note: null, sets: sets(2), circuit_id: "g1" },
        { exercise_id: bench, note: null, sets: sets(2), circuit_id: "g1" },
      ],
    });
    expect((await plansRepo.get(id))!.circuits).toEqual([C]);
    const w = await started(id);
    expect("rest" in w.workout).toBe(false);
    expect(w.items.some((i) => "circuit_id" in i.we)).toBe(false);
  });
});
