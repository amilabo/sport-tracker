import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "./client";
import { demoRepo } from "./repos/demo";
import { workoutsRepo } from "./repos/workouts";
import { exerciseSeedId } from "./seed";

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

describe("demo data", () => {
  it("loads ~12 finished workouts over 4 weeks with growing weights and 4 measurements; once only", async () => {
    const now = new Date("2026-10-16T12:00:00");
    await demoRepo.load(now);
    await demoRepo.load(now);
    const db = await getDb();
    const workouts = await db.getAll("workouts");
    expect(workouts).toHaveLength(12);
    expect(workouts.every((w) => w.is_demo && w.status === "finished" && w.mood_after !== null)).toBe(true);
    expect(new Set((await db.getAll("measurements")).map((m) => m.date)).size).toBe(4);

    const pec = (await workoutsRepo.exerciseSessions([exerciseSeedId("pec_deck")])).reverse();
    const maxWeights = pec.map((s) => Math.max(...s.sets.map((x) => x.weight ?? 0)));
    expect(maxWeights[0]).toBeLessThan(maxWeights.at(-1)!);
    expect(maxWeights.at(-1)).toBe(15);
  });

  it("remove deletes only demo records", async () => {
    const r = await workoutsRepo.start(null);
    if (r.status !== "started") throw new Error("expected start");
    await demoRepo.load(new Date("2026-10-16T12:00:00"));
    expect(await demoRepo.isLoaded()).toBe(true);

    await demoRepo.remove();
    expect(await demoRepo.isLoaded()).toBe(false);
    const db = await getDb();
    expect((await db.getAll("workouts")).map((w) => w.id)).toEqual([r.id]);
    expect(await db.count("exercises")).toBe(44);
    expect(await db.count("measurements")).toBe(0);
  });
});
