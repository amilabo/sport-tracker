import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isOneSideCatalog } from "@/content/exercise-one-side";
import { parseBackup } from "@/domain/backup";
import { getDb, resetDbForTests } from "./client";
import { backupRepo } from "./repos/backup";
import { exercisesRepo } from "./repos/exercises";
import { exerciseSeedId } from "./seed";

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

describe("«Как прибавлять» of an exercise (stage 51а)", () => {
  it("is stored on catalog exercises too, goes into the backup, null brings the default back", async () => {
    await getDb();
    const id = exerciseSeedId("cable_kickback");
    const e = await exercisesRepo.setProgress(id, { rep_ceiling: 16, weight_step: 5, per_side: true, progress_prefer: "reps" });
    expect(e).toMatchObject({ rep_ceiling: 16, weight_step: 5, per_side: true, progress_prefer: "reps" });
    const file = parseBackup(JSON.stringify(await backupRepo.exportAll()));
    expect(file.data.exercises?.find((x) => x.id === id)).toMatchObject({ rep_ceiling: 16, weight_step: 5, per_side: true });
    const back = await exercisesRepo.setProgress(id, { rep_ceiling: null, weight_step: null, per_side: false, progress_prefer: null });
    for (const k of ["rep_ceiling", "weight_step", "per_side", "progress_prefer"]) expect(k in back).toBe(false);
  });

  it("refuses values out of range", async () => {
    await getDb();
    const id = exerciseSeedId("cable_kickback");
    await expect(exercisesRepo.setProgress(id, { rep_ceiling: 2 })).rejects.toThrow("Потолок");
    await expect(exercisesRepo.setProgress(id, { weight_step: 0 })).rejects.toThrow("Шаг");
  });

  it("one-side catalog hint", async () => {
    expect(isOneSideCatalog({ id: exerciseSeedId("bulgarian_split_squat"), is_builtin: true })).toBe(true);
    expect(isOneSideCatalog({ id: exerciseSeedId("pec_deck"), is_builtin: true })).toBe(false);
  });
});
