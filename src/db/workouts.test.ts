import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { touch } from "@/domain/entity";
import { resetDbForTests } from "./client";
import { exercisesRepo } from "./repos/exercises";
import { plansRepo } from "./repos/plans";
import { workoutsRepo, type WorkoutFull } from "./repos/workouts";
import { exerciseSeedId, planSeedId } from "./seed";

const LEGS = planSeedId("plan_legs_chest_arms");

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

async function startFull(planId: string | null = LEGS): Promise<WorkoutFull> {
  const r = await workoutsRepo.start(planId);
  if (r.status !== "started") throw new Error("expected start");
  return (await workoutsRepo.getFull(r.id))!;
}

/** Marks every set done and finishes the workout at the given time. */
async function finishAllDone(full: WorkoutFull, at: string) {
  const sets = full.items.flatMap((i) => i.sets.map((s) => touch(s, { done_at: at })));
  await workoutsRepo.put({ sets, workout: touch(full.workout, { status: "finished", finished_at: at }) });
}

describe("workoutsRepo.start", () => {
  it("copies the plan: exercises in order, values and targets from plan sets, plan note available", async () => {
    const full = await startFull();
    expect(full.plan?.name).toBe("Ноги / грудь / руки");
    expect(full.items).toHaveLength(10);
    expect(full.items[0].exercise.name).toBe("Ходьба на дорожке");
    const pec = full.items[2];
    expect(pec.sets.map((s) => [s.weight, s.reps, s.target_weight, s.target_reps, s.done_at])).toEqual([
      [15, 15, 15, 15, null], [15, 15, 15, 15, null], [15, 15, 15, 15, null],
    ]);
    const glutes = await startFullAfterFinish();
    expect(glutes.items[6].planNote).toBe("на каждую ногу по 10 раз");
  });

  it("allows only one workout in progress", async () => {
    const first = await startFull();
    const second = await workoutsRepo.start(planSeedId("plan_glutes_back"));
    expect(second.status).toBe("conflict");
    expect(second.status === "conflict" && second.active.id).toBe(first.workout.id);
    expect((await workoutsRepo.getActive())?.id).toBe(first.workout.id);
  });

  it("starts an empty workout without a plan", async () => {
    const full = await startFull(null);
    expect(full.plan).toBeNull();
    expect(full.items).toEqual([]);
  });
});

async function startFullAfterFinish() {
  const active = await workoutsRepo.getActive();
  if (active) await workoutsRepo.put({ workout: touch(active, { status: "finished", finished_at: active.started_at }) });
  return startFull(planSeedId("plan_glutes_back"));
}

describe("changes for today", () => {
  it("replacing an exercise keeps the plan and remembers what was replaced", async () => {
    const full = await startFull();
    const item = full.items[7]; // Приведение ног
    const lunges = (await exercisesRepo.get(exerciseSeedId("dumbbell_lunges")))!;
    await workoutsRepo.replaceExercise(item.we.id, lunges);

    const after = (await workoutsRepo.getFull(full.workout.id))!;
    expect(after.items[7].exercise.name).toBe("Выпады с гантелями");
    expect(after.items[7].replaced?.name).toBe("Приведение ног в тренажёре сидя");
    // Same log type and no history for lunges: values kept, plan targets dropped.
    expect(after.items[7].sets.map((s) => s.weight)).toEqual([25, 25, 25]);
    expect(after.items[7].sets.every((s) => s.plan_set_id === null && s.target_weight === null)).toBe(true);

    const plan = (await plansRepo.getFull(LEGS))!;
    expect(plan.items[7].exercise.name).toBe("Приведение ног в тренажёре сидя");

    // Replacing back to the original clears the mark.
    await workoutsRepo.replaceExercise(item.we.id, after.items[7].replaced!);
    expect((await workoutsRepo.getFull(full.workout.id))!.items[7].replaced).toBeNull();
  });

  it("replacing with another log type resets the sets", async () => {
    const full = await startFull();
    const plank = (await exercisesRepo.get(exerciseSeedId("forearm_plank")))!;
    await workoutsRepo.replaceExercise(full.items[2].we.id, plank);
    const sets = (await workoutsRepo.getFull(full.workout.id))!.items[2].sets;
    expect(sets).toHaveLength(3);
    expect(sets.every((s) => s.weight === null && s.reps === null && s.plan_set_id === null)).toBe(true);
  });

  it("a replacement starts from last time's result for the new exercise", async () => {
    const first = await startFull();
    await finishAllDone(first, "2026-10-05T07:00:00.000Z");
    const second = await startFull();
    const pec = (await exercisesRepo.get(exerciseSeedId("pec_deck")))!;
    await workoutsRepo.replaceExercise(second.items[6].we.id, pec); // leg curl 4 × 12 × 20 → pec deck
    const sets = (await workoutsRepo.getFull(second.workout.id))!.items[6].sets;
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[15, 15], [15, 15], [15, 15]]);
  });

  it("an added exercise starts from last time's result", async () => {
    const first = await startFull();
    await finishAllDone(first, "2026-10-05T07:00:00.000Z");

    const free = await startFull(null);
    await workoutsRepo.addExercise(free.workout.id, exerciseSeedId("pec_deck"));
    await workoutsRepo.addExercise(free.workout.id, exerciseSeedId("bench_press"));
    const after = (await workoutsRepo.getFull(free.workout.id))!;
    expect(after.items.map((i) => i.exercise.name)).toEqual(["Сведение рук в тренажёре (Пек-дек)", "Жим лёжа"]);
    expect(after.items[0].sets.map((s) => [s.weight, s.reps])).toEqual([[15, 15], [15, 15], [15, 15]]);
    // Never done before: one empty set.
    expect(after.items[1].sets.map((s) => [s.weight, s.reps])).toEqual([[null, null]]);
  });
});

describe("history helpers", () => {
  it("last sets come from the latest completed workout and skip the current one", async () => {
    const first = await startFull();
    const pec = first.items[2];
    await workoutsRepo.put({ sets: pec.sets.map((s) => touch(s, { weight: 17.5 })) });
    await finishAllDone({ ...first, items: first.items.map((i) => (i === pec ? { ...i, sets: pec.sets.map((s) => ({ ...s, weight: 17.5 })) } : i)) }, "2026-10-05T07:00:00.000Z");

    const second = await startFull();
    const last = await workoutsRepo.lastSetsByExercise([pec.exercise.id], second.workout.id);
    expect(last.get(pec.exercise.id)?.map((s) => s.weight)).toEqual([17.5, 17.5, 17.5]);

    const byPlan = await workoutsRepo.lastStartedByPlan();
    expect(byPlan.get(LEGS)).toBe(first.workout.started_at);
  });

  it("auto-finishes a workout left from yesterday at its last activity", async () => {
    const full = await startFull();
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const started = new Date(yesterday.setHours(9, 0, 0, 0)).toISOString();
    const done = new Date(new Date(started).getTime() + 40 * 60 * 1000).toISOString();
    await workoutsRepo.put({
      workout: { ...full.workout, started_at: started },
      sets: [touch(full.items[0].sets[0], { done_at: done })],
    });

    expect(await workoutsRepo.autoFinishStale()).toEqual([full.workout.id]);
    const w = (await workoutsRepo.get(full.workout.id))!;
    expect(w).toMatchObject({ status: "auto_finished", finished_at: done, plan_update_prompted: false });
    expect(await workoutsRepo.getActive()).toBeUndefined();
    // Today's workout is not touched.
    await startFull();
    expect(await workoutsRepo.autoFinishStale()).toEqual([]);
  });
});

describe("finishing", () => {
  it("complete() saves times and ratings and does not ask about the plan again", async () => {
    const full = await startFull();
    await workoutsRepo.complete(full.workout.id, {
      started_at: "2026-10-15T06:24:00.000Z",
      finished_at: "2026-10-15T07:26:00.000Z",
      energy_after: 4,
      mood_after: 5,
      note: "тяжело",
    });
    const w = (await workoutsRepo.get(full.workout.id))!;
    expect(w).toMatchObject({ status: "finished", energy_after: 4, mood_after: 5, note: "тяжело", plan_update_prompted: true });
    expect(await workoutsRepo.getActive()).toBeUndefined();
    expect(await workoutsRepo.pendingPlanPrompt()).toBeUndefined();
  });

  it("a workout finished another way waits for the plan question", async () => {
    const full = await startFull();
    await workoutsRepo.finish(full.workout.id);
    expect((await workoutsRepo.pendingPlanPrompt())?.id).toBe(full.workout.id);
    await workoutsRepo.markPlanPrompted(full.workout.id);
    expect(await workoutsRepo.pendingPlanPrompt()).toBeUndefined();
  });

  it("applySetUpdates changes only the checked plan sets", async () => {
    const plan = (await plansRepo.getFull(LEGS))!;
    const curl = plan.items[3];
    const n = await plansRepo.applySetUpdates([
      { planSetId: curl.sets[1].id, field: "weight", value: 17.5 },
      { planSetId: curl.sets[2].id, field: "weight", value: 17.5 },
      { planSetId: curl.sets[2].id, field: "reps", value: 8 },
      { planSetId: "missing", field: "weight", value: 1 },
    ]);
    expect(n).toBe(2);
    const after = (await plansRepo.getFull(LEGS))!.items[3].sets;
    expect(after.map((s) => [s.weight, s.reps])).toEqual([[15, 10], [17.5, 10], [17.5, 8], [15, 10]]);
  });
});

describe("history", () => {
  it("lists only finished workouts with plan name and summary", async () => {
    const done = await startFull();
    await finishAllDone(done, "2026-10-05T07:24:00.000Z");
    const r = await workoutsRepo.start(null);
    expect(r.status).toBe("started");

    const list = await workoutsRepo.listHistory();
    expect(list).toHaveLength(1);
    expect(list[0].planName).toBe("Ноги / грудь / руки");
    expect(list[0].summary.percent).toBe(100);
    expect(list[0].summary.volumeKg).toBe(4899);
  });

  it("remove deletes the workout with its exercises and sets; the plan rotation forgets it", async () => {
    const full = await startFull();
    await finishAllDone(full, "2026-10-05T07:24:00.000Z");
    expect((await workoutsRepo.lastStartedByPlan()).has(LEGS)).toBe(true);

    await workoutsRepo.remove(full.workout.id);
    expect(await workoutsRepo.getFull(full.workout.id)).toBeUndefined();
    const { getDb } = await import("./client");
    const db = await getDb();
    expect(await db.count("workout_exercises")).toBe(0);
    expect(await db.count("workout_sets")).toBe(0);
    expect((await workoutsRepo.lastStartedByPlan()).has(LEGS)).toBe(false);
  });
});
