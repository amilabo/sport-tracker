import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "./client";
import { progressionsRepo } from "./repos/progressions";
import { exerciseSeedId } from "./seed";

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

const GRAVITRON = exerciseSeedId("assisted_pull_ups");
const BAND = exerciseSeedId("band_pull_ups");
const PULL = exerciseSeedId("pull_ups");
const names = async (id: string) => (await progressionsRepo.chainOf(id))?.members.map((m) => m.name);

describe("progressionsRepo", () => {
  it("builds «Гравитрон → с резинкой → подтягивания» from either end", async () => {
    await progressionsRepo.link(BAND, GRAVITRON, "easier", "Подтягивания");
    await progressionsRepo.link(PULL, BAND, "easier", "");
    expect(await names(PULL)).toEqual(["Гравитрон", "Подтягивания с резинкой", "Подтягивания"]);
    expect((await progressionsRepo.chainOf(GRAVITRON))?.progression.name).toBe("Подтягивания");
  });

  it("refuses a second chain for the same exercise and a link to itself", async () => {
    await progressionsRepo.link(BAND, GRAVITRON, "easier", "Подтягивания");
    await progressionsRepo.link(exerciseSeedId("push_ups"), exerciseSeedId("knee_push_ups"), "easier", "Отжимания");
    await expect(progressionsRepo.link(BAND, exerciseSeedId("push_ups"), "harder", "")).rejects.toThrow("уже в прогрессии «Отжимания»");
    await expect(progressionsRepo.link(BAND, BAND, "harder", "")).rejects.toThrow("другое");
    await expect(progressionsRepo.link(BAND, GRAVITRON, "harder", "")).rejects.toThrow("уже в этой прогрессии");
  });

  it("moves levels, excludes, and dissolves a chain of one", async () => {
    await progressionsRepo.link(BAND, GRAVITRON, "easier", "Подтягивания");
    await progressionsRepo.link(BAND, PULL, "harder", "");
    await progressionsRepo.move(PULL, -1);
    expect(await names(PULL)).toEqual(["Гравитрон", "Подтягивания", "Подтягивания с резинкой"]);

    await progressionsRepo.exclude(PULL);
    expect(await names(GRAVITRON)).toEqual(["Гравитрон", "Подтягивания с резинкой"]);
    expect(await progressionsRepo.chainOf(PULL)).toBeNull();

    await progressionsRepo.exclude(BAND);
    expect(await progressionsRepo.chainOf(GRAVITRON)).toBeNull();
    expect(await (await getDb()).count("progressions")).toBe(0);
  });
});
