import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { touch } from "@/domain/entity";
import { addedExercise, replacedExercise } from "@/domain/workout";
import { resetDbForTests } from "./client";
import { exercisesRepo } from "./repos/exercises";
import { plansRepo } from "./repos/plans";
import { workoutsRepo } from "./repos/workouts";
import { exerciseSeedId, planSeedId } from "./seed";

const LEGS = planSeedId("plan_legs_chest_arms");

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

describe("workout before «Начать»", () => {
  it("a draft copies the plan but stores nothing", async () => {
    const draft = await workoutsRepo.draft(LEGS);
    expect(draft.plan?.name).toBe("Ноги / грудь / руки");
    expect(draft.items).toHaveLength(10);
    expect(draft.items[2].sets.map((s) => [s.weight, s.reps, s.target_weight])).toEqual([
      [15, 15, 15], [15, 15, 15], [15, 15, 15],
    ]);
    expect(await workoutsRepo.getActive()).toBeUndefined();
    expect(await workoutsRepo.get(draft.workout.id)).toBeUndefined();
  });

  it("«Без плана» is a draft too: nothing stored until «Начать», exercises added before it are kept", async () => {
    const draft = await workoutsRepo.draft(null);
    expect(draft.plan).toBeNull();
    expect(draft.items).toEqual([]);
    expect(await workoutsRepo.getActive()).toBeUndefined();

    const bench = (await exercisesRepo.get(exerciseSeedId("bench_press")))!;
    const added = addedExercise(draft.workout.id, bench.id, 0, undefined);
    const item = { we: added.we, exercise: bench, replaced: null, planNote: null, sets: added.sets };
    const r = await workoutsRepo.startDraft({ ...draft, items: [item] });
    expect(r.status).toBe("started");
    const full = (await workoutsRepo.getFull(draft.workout.id))!;
    expect(full.workout.plan_id).toBeNull();
    expect(full.workout.status).toBe("in_progress");
    expect(full.items.map((i) => i.exercise.id)).toEqual([bench.id]);
  });

  it("a draft of a missing plan fails", async () => {
    await expect(workoutsRepo.draft("nope")).rejects.toThrow("План не найден");
  });

  it("starting a draft stores today's changes, the start time is now, the plan is untouched", async () => {
    const draft = await workoutsRepo.draft(LEGS);
    const pec = draft.items[2];
    const heavier = pec.sets.map((s) => touch(s, { weight: 17.5 }));
    const plank = (await exercisesRepo.get(exerciseSeedId("forearm_plank")))!;
    const swapped = replacedExercise(draft.items[3].we, draft.items[3].exercise.log_type, draft.items[3].sets, plank, undefined);
    const added = addedExercise(draft.workout.id, exerciseSeedId("bench_press"), draft.items.length, undefined);
    const edited = {
      ...draft,
      workout: { ...draft.workout, started_at: "2020-01-01T00:00:00.000Z", wellbeing_before: 4 },
      items: [
        ...draft.items.slice(0, 2),
        { ...pec, sets: heavier },
        { ...draft.items[3], we: swapped.we, exercise: plank, replaced: draft.items[3].exercise, sets: swapped.sets },
        ...draft.items.slice(4),
        { we: added.we, exercise: (await exercisesRepo.get(exerciseSeedId("bench_press")))!, replaced: null, planNote: null, sets: added.sets },
      ],
    };

    const before = Date.now();
    const r = await workoutsRepo.startDraft(edited);
    expect(r.status).toBe("started");
    const full = (await workoutsRepo.getFull(draft.workout.id))!;
    expect(full.workout.status).toBe("in_progress");
    expect(new Date(full.workout.started_at).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(full.workout.wellbeing_before).toBe(4);
    expect(full.items).toHaveLength(11);
    expect(full.items[2].sets.map((s) => [s.weight, s.target_weight])).toEqual([[17.5, 15], [17.5, 15], [17.5, 15]]);
    expect(full.items[3].exercise.id).toBe(plank.id);
    expect(full.items[3].replaced?.id).toBe(draft.items[3].exercise.id);
    expect(full.items[10].exercise.name).toBe("Жим лёжа");

    const plan = (await plansRepo.getFull(LEGS))!;
    expect(plan.items).toHaveLength(10);
    expect(plan.items[2].sets.map((s) => s.weight)).toEqual([15, 15, 15]);
  });

  it("only one workout in progress: starting a draft while another one goes on is a conflict", async () => {
    const first = await workoutsRepo.start(planSeedId("plan_glutes_back"));
    const draft = await workoutsRepo.draft(LEGS);
    const r = await workoutsRepo.startDraft(draft);
    expect(r.status).toBe("conflict");
    expect(r.status === "conflict" && first.status === "started" && r.active.id).toBe(first.status === "started" && first.id);
    expect(await workoutsRepo.get(draft.workout.id)).toBeUndefined();
  });
});

describe("planStats", () => {
  it("counts completed workouts by the plan and the latest start", async () => {
    expect(await workoutsRepo.planStats(LEGS)).toEqual({ count: 0, last: null });
    for (const at of ["2026-10-05T07:00:00.000Z", "2026-10-09T07:00:00.000Z"]) {
      const r = await workoutsRepo.start(LEGS);
      if (r.status !== "started") throw new Error("expected start");
      const w = (await workoutsRepo.get(r.id))!;
      await workoutsRepo.put({ workout: touch(w, { started_at: at, status: "finished", finished_at: at }) });
    }
    await workoutsRepo.start(LEGS); // in progress — not counted
    expect(await workoutsRepo.planStats(LEGS)).toEqual({ count: 2, last: "2026-10-09T07:00:00.000Z" });
  });
});
