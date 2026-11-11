import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { choose, planChanges } from "@/domain/plan-diff";
import { resetDbForTests } from "./client";
import { applyPlanDecision } from "./plan-decision";
import { exercisesRepo } from "./repos/exercises";
import { plansRepo } from "./repos/plans";
import { workoutsRepo } from "./repos/workouts";
import { exerciseSeedId } from "./seed";

const glute = exerciseSeedId("cable_kickback");
const line = (n: number, weight: number, reps: number) => Array.from({ length: n }, () => ({ weight, reps, duration_sec: null, speed_kmh: null }));

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

/** A completed workout by the plan on day `d` of October, all sets done at the plan. */
async function workoutAtPlan(planId: string, d: number) {
  const r = await workoutsRepo.start(planId);
  if (r.status !== "started") throw new Error("expected start");
  const full = (await workoutsRepo.getFull(r.id))!;
  const at = new Date(Date.UTC(2026, 9, d, 10)).toISOString();
  await workoutsRepo.put({
    workout: { ...full.workout, started_at: at },
    sets: full.items.flatMap((i) => i.sets.map((s) => ({ ...s, done_at: at }))),
  });
  await workoutsRepo.finish(r.id, at);
  return (await workoutsRepo.getFull(r.id))!;
}

describe("«Обновить план?» with choices (stage 52)", () => {
  it("past lines of the same plan, newest first; the run of a line ends where it is missing", async () => {
    const plan = await plansRepo.save({ name: "Ягодицы", items: [{ exercise_id: glute, note: null, sets: line(3, 40, 12) }] });
    await workoutAtPlan(plan, 1);
    await workoutAtPlan(plan, 8);
    const today = await workoutAtPlan(plan, 15);
    const past = await workoutsRepo.pastPlanLines(today.workout);
    const pe = today.items[0].we.plan_exercise_id!;
    expect(past.get(pe)?.map((p) => p.started_at.slice(0, 10))).toEqual(["2026-10-08", "2026-10-01"]);
  });

  it("+1 подход adds a copy of the last plan set and remembers «повторы» first", async () => {
    const plan = await plansRepo.save({ name: "Ягодицы", items: [{ exercise_id: glute, note: null, sets: line(3, 50, 15) }] });
    await workoutAtPlan(plan, 1);
    const today = await workoutAtPlan(plan, 8);
    const changes = planChanges(today.items, { past: await workoutsRepo.pastPlanLines(today.workout), startedAt: today.workout.started_at });
    expect(changes.map((c) => c.progress?.choices.map((x) => x.kind))).toEqual([["weight_reset", "set"]]);

    await applyPlanDecision([choose(changes[0], 1)]);
    const after = (await plansRepo.getFull(plan))!;
    expect(after.items[0].sets.map((s) => `${s.position}:${s.weight}×${s.reps}`)).toEqual(["0:50×15", "1:50×15", "2:50×15", "3:50×15"]);
    expect((await exercisesRepo.get(glute))?.progress_prefer).toBe("reps");
  });

  it("heavier at the ceiling: weight up, reps down by 3, «вес» first next time", async () => {
    const plan = await plansRepo.save({ name: "Ягодицы", items: [{ exercise_id: glute, note: null, sets: line(3, 50, 15) }] });
    await exercisesRepo.setProgress(glute, { weight_step: 5, progress_prefer: "reps" });
    await workoutAtPlan(plan, 1);
    const today = await workoutAtPlan(plan, 8);
    const [c] = planChanges(today.items, { past: await workoutsRepo.pastPlanLines(today.workout), startedAt: today.workout.started_at });
    expect(c.progress?.choices.map((x) => x.label)).toEqual(["+1 подход", "+5 кг, 12 раз"]);
    await applyPlanDecision([choose(c, 1)]);
    const after = (await plansRepo.getFull(plan))!;
    expect(after.items[0].sets.map((s) => `${s.weight}×${s.reps}`)).toEqual(["55×12", "55×12", "55×12"]);
    expect((await exercisesRepo.get(glute))?.progress_prefer).toBe("weight");
  });
});
