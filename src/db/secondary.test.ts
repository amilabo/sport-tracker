import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBackup } from "@/domain/backup";
import { resetDbForTests } from "./client";
import { backupRepo } from "./repos/backup";
import { exercisesRepo } from "./repos/exercises";
import { exerciseSeedId } from "./seed";

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

describe("secondary groups of an own exercise (stage 42б)", () => {
  it("are stored cleaned, follow the main group and go into the backup", async () => {
    const e = await exercisesRepo.create({ name: "Тяга в наклоне на ТРХ", muscle_group: "back", equipment: "other", log_type: "reps", secondary_groups: ["arms", "back", "shoulders", "legs"] });
    expect(e.secondary_groups).toEqual(["arms", "shoulders"]);
    // The new main group drops itself from the secondary ones.
    expect((await exercisesRepo.update(e.id, { muscle_group: "arms" })).secondary_groups).toEqual(["shoulders"]);
    expect("secondary_groups" in (await exercisesRepo.update(e.id, { secondary_groups: [] }))).toBe(false);
    await exercisesRepo.update(e.id, { secondary_groups: ["back"] });
    const file = parseBackup(JSON.stringify(await backupRepo.exportAll()));
    expect(file.data.exercises?.find((x) => x.id === e.id)?.secondary_groups).toEqual(["back"]);
  });

  it("without a choice the field is absent; catalog exercises never get one", async () => {
    const e = await exercisesRepo.create({ name: "Своё", muscle_group: "chest", equipment: "other", log_type: "reps" });
    expect("secondary_groups" in e).toBe(false);
    const row = await exercisesRepo.update(exerciseSeedId("seated_cable_row"), { secondary_groups: ["legs"] });
    expect(row.secondary_groups).toBeUndefined();
  });
});
