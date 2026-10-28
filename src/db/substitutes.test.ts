import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBackup } from "@/domain/backup";
import { touch } from "@/domain/entity";
import { substituteSections } from "@/domain/substitutes";
import { resetDbForTests } from "./client";
import { backupRepo } from "./repos/backup";
import { demoRepo } from "./repos/demo";
import { exercisesRepo } from "./repos/exercises";
import { substituteContext } from "./repos/substitutes";
import { workoutsRepo } from "./repos/workouts";
import { exerciseSeedId, planSeedId } from "./seed";

const BACK = planSeedId("plan_glutes_back");
const CABLE_ROW = exerciseSeedId("seated_cable_row");
const HAMMER = exerciseSeedId("hammer_row");
const DB_ROW = exerciseSeedId("dumbbell_row");

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

/** «Ягодицы / спина» with the cable row (4th) replaced by `to`, everything done, finished at `at`. */
async function workoutWithReplacement(to: string, at: string) {
  const r = await workoutsRepo.start(BACK);
  if (r.status !== "started") throw new Error("expected start");
  const full = (await workoutsRepo.getFull(r.id))!;
  await workoutsRepo.replaceExercise(full.items[3].we.id, (await exercisesRepo.get(to))!);
  const after = (await workoutsRepo.getFull(r.id))!;
  await workoutsRepo.put({
    sets: after.items.flatMap((i) => i.sets.map((s) => touch(s, { done_at: at }))),
    workout: touch(after.workout, { status: "finished", finished_at: at, started_at: at, plan_update_prompted: true }),
  });
}

describe("«Ваша замена»", () => {
  it("is set, changed and cleared; not to itself", async () => {
    await exercisesRepo.setSubstitute(CABLE_ROW, DB_ROW);
    expect((await exercisesRepo.get(CABLE_ROW))?.substitute_id).toBe(DB_ROW);
    await exercisesRepo.setSubstitute(CABLE_ROW, null);
    expect((await exercisesRepo.get(CABLE_ROW))?.substitute_id).toBeNull();
    await expect(exercisesRepo.setSubstitute(CABLE_ROW, CABLE_ROW)).rejects.toThrow("другое");
    await expect(exercisesRepo.setSubstitute(CABLE_ROW, "missing")).rejects.toThrow("не найдено");
  });

  it("goes to the backup and comes back with «Заменить всё» and «Объединить»", async () => {
    await exercisesRepo.setSubstitute(CABLE_ROW, DB_ROW);
    const file = parseBackup(JSON.stringify(await backupRepo.exportAll()));
    for (const mode of ["replace", "merge"] as const) {
      await resetDbForTests();
      await exercisesRepo.list();
      await backupRepo.import(file, mode);
      expect((await exercisesRepo.get(CABLE_ROW))?.substitute_id, mode).toBe(DB_ROW);
    }
  });
});

describe("substituteContext", () => {
  it("gathers the reference, past replacements and last results", async () => {
    await workoutWithReplacement(HAMMER, "2026-10-02T07:00:00.000Z");
    await exercisesRepo.setSubstitute(CABLE_ROW, DB_ROW);
    const ctx = (await substituteContext(CABLE_ROW))!;
    expect(ctx.catalog[0].id).toBe(HAMMER);
    expect(ctx.replaced.map((r) => [r.exerciseId, r.at])).toEqual([[HAMMER, "2026-10-02T07:00:00.000Z"]]);
    // Same log type, never done before: the values typed for the cable row carry over.
    expect(ctx.last.get(HAMMER)?.sets.map((s) => s.weight)).toEqual([10, 10, 10]);

    const s = substituteSections({ ...ctx, excludeIds: [exerciseSeedId("band_pull_ups"), exerciseSeedId("superman_scapula")] });
    expect(s.mine?.exercise.id).toBe(DB_ROW);
    expect(s.similar[0].exercise.id).toBe(HAMMER);
    expect(s.similar[0].mark).toMatchObject({ kind: "replaced", at: "2026-10-02T07:00:00.000Z" });
    const offered = [s.mine!, ...s.similar, ...s.more].map((r) => r.exercise.id);
    expect(offered).not.toContain(CABLE_ROW);
    expect(offered).not.toContain(exerciseSeedId("band_pull_ups"));
    expect(new Set(offered).size).toBe(offered.length);
  });

  it("a workout in progress is not a past replacement", async () => {
    const r = await workoutsRepo.start(BACK);
    if (r.status !== "started") throw new Error("expected start");
    const full = (await workoutsRepo.getFull(r.id))!;
    await workoutsRepo.replaceExercise(full.items[3].we.id, (await exercisesRepo.get(HAMMER))!);
    expect((await substituteContext(CABLE_ROW))!.replaced).toEqual([]);
  });

  it("the demo history has one replacement of the cable row", async () => {
    await demoRepo.load(new Date("2026-10-28T12:00:00"));
    const ctx = (await substituteContext(CABLE_ROW))!;
    expect(ctx.replaced.map((r) => r.exerciseId)).toEqual([HAMMER]);
    expect(ctx.replaced[0].sets.every((s) => s.weight === 25)).toBe(true);
  });
});
