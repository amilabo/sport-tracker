import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newEntity } from "@/domain/entity";
import { DomainError, type WorkoutExercise } from "@/domain/types";
import { closeDb, getDb, resetDbForTests, withTx } from "./client";
import { onChange } from "./events";
import { exercisesRepo } from "./repos/exercises";
import { measurementsRepo } from "./repos/measurements";
import { plansRepo } from "./repos/plans";
import { settingsRepo } from "./repos/settings";
import { SEED_EXERCISES, SEED_MEASUREMENT_TYPES, SEED_PLANS } from "./seed/catalog";
import { exerciseSeedId, planSeedId, seedIfNeeded } from "./seed";

beforeEach(async () => {
  await resetDbForTests();
});

afterEach(async () => {
  await resetDbForTests();
});

/** Pretends the exercise was done in a workout. */
async function addHistory(exerciseId: string) {
  const db = await getDb();
  const we: WorkoutExercise = newEntity({
    workout_id: "w1",
    exercise_id: exerciseId,
    replaced_exercise_id: null,
    plan_exercise_id: null,
    position: 0,
    skipped: false,
    note: null,
  });
  await db.put("workout_exercises", we);
}

describe("seed", () => {
  it("creates catalog, starter plans, measurement types and settings on first open", async () => {
    const exercises = await exercisesRepo.list();
    expect(exercises).toHaveLength(SEED_EXERCISES.length);
    expect(exercises.every((e) => e.is_builtin && !e.is_demo)).toBe(true);

    const plans = await plansRepo.list();
    expect(plans.map((p) => p.name)).toEqual(["Ноги / грудь / руки", "Ягодицы / спина"]);

    const legs = await plansRepo.getFull(planSeedId("plan_legs_chest_arms"));
    expect(legs!.items).toHaveLength(10);
    expect(legs!.items[0].exercise.name).toBe("Ходьба на дорожке");
    expect(legs!.items[0].sets[0]).toMatchObject({ duration_sec: 900, speed_kmh: 10, weight: null });
    expect(legs!.items[2].sets.map((s) => [s.reps, s.weight])).toEqual([[15, 15], [15, 15], [15, 15]]);

    const glutes = await plansRepo.getFull(planSeedId("plan_glutes_back"));
    expect(glutes!.items).toHaveLength(8);
    expect(glutes!.items[6].planExercise.note).toBe("на каждую ногу по 10 раз");

    const types = await measurementsRepo.listTypes();
    expect(types.map((t) => t.key)).toEqual(SEED_MEASUREMENT_TYPES.map((t) => t.key));
    const fatPct = types.find((t) => t.key === "fat_pct")!;
    expect(fatPct.base_type_id).toBe(types.find((t) => t.key === "fat_kg")!.id);

    const settings = await settingsRepo.get();
    expect(settings).toMatchObject({ schema_version: 1, theme_mode: "system", color_theme: "card", height_cm: null });
  });

  it("every plan item refers to a catalog exercise and seed ids are unique", () => {
    const keys = new Set(SEED_EXERCISES.map((e) => e.key));
    SEED_PLANS.flatMap((p) => p.items).forEach((i) => expect(keys.has(i.exercise)).toBe(true));
    const ids = SEED_EXERCISES.map((e) => exerciseSeedId(e.key));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(SEED_EXERCISES.map((e) => e.name)).size).toBe(SEED_EXERCISES.length);
  });

  it("does not seed twice", async () => {
    const db = await getDb();
    expect(await seedIfNeeded(db)).toBe(false);
    expect(await db.count("exercises")).toBe(SEED_EXERCISES.length);
  });

  it("data survives reopening the database", async () => {
    await exercisesRepo.create({ name: "Мой жим", muscle_group: "chest", equipment: "machine", log_type: "weight_reps" });
    // App restart: the connection is gone, the data is not.
    await closeDb();
    const db = await getDb();
    const names = (await db.getAll("exercises")).map((e) => e.name);
    expect(names).toContain("Мой жим");
    expect(await db.count("exercises")).toBe(SEED_EXERCISES.length + 1);
  });
});

describe("exercisesRepo", () => {
  const input = { name: "  Жим   в тренажёре ", muscle_group: "chest", equipment: "machine", log_type: "weight_reps" } as const;

  it("creates with a cleaned name and rejects duplicates ignoring case and ё", async () => {
    const created = await exercisesRepo.create(input);
    expect(created.name).toBe("Жим в тренажёре");
    expect(created.is_builtin).toBe(false);
    await expect(exercisesRepo.create({ ...input, name: "ЖИМ В ТРЕНАЖЕРЕ" })).rejects.toThrow(DomainError);
    await expect(exercisesRepo.create({ ...input, name: "   " })).rejects.toThrow("Введите название");
  });

  it("renames in place, so plans see the new name", async () => {
    const id = exerciseSeedId("pec_deck");
    await exercisesRepo.update(id, { name: "Бабочка" });
    const plan = await plansRepo.getFull(planSeedId("plan_legs_chest_arms"));
    expect(plan!.items[2].exercise.name).toBe("Бабочка");
  });

  it("forbids changing the log type once there is history", async () => {
    const created = await exercisesRepo.create(input);
    await exercisesRepo.update(created.id, { log_type: "reps" });
    await addHistory(created.id);
    expect(await exercisesRepo.hasHistory(created.id)).toBe(true);
    await expect(exercisesRepo.update(created.id, { log_type: "time" })).rejects.toThrow("Тип записи нельзя изменить");
    // Other fields can still change.
    await exercisesRepo.update(created.id, { equipment: "cable" });
  });

  it("archives instead of deleting and warns about plans using it", async () => {
    const id = exerciseSeedId("treadmill_walk");
    const used = await exercisesRepo.usedInPlans(id);
    expect(used.map((p) => p.name)).toEqual(["Ноги / грудь / руки", "Ягодицы / спина"]);

    await exercisesRepo.archive(id);
    expect((await exercisesRepo.list()).some((e) => e.id === id)).toBe(false);
    expect((await exercisesRepo.listArchived()).map((e) => e.id)).toEqual([id]);
    expect(await exercisesRepo.get(id)).toBeDefined();

    await exercisesRepo.restore(id);
    expect((await exercisesRepo.list()).some((e) => e.id === id)).toBe(true);
  });
});

describe("plansRepo", () => {
  const bench = exerciseSeedId("bench_press");
  const squat = exerciseSeedId("barbell_squat");
  const sets = (n: number, weight: number, reps: number) =>
    Array.from({ length: n }, () => ({ weight, reps, duration_sec: null, speed_kmh: null }));

  it("saves a new plan with ordered exercises and sets", async () => {
    const id = await plansRepo.save({
      name: " Фулбоди ",
      items: [
        { exercise_id: bench, note: "узкий хват", sets: sets(3, 40, 10) },
        { exercise_id: squat, note: null, sets: sets(4, 50, 8) },
      ],
    });
    const full = await plansRepo.getFull(id);
    expect(full!.plan).toMatchObject({ name: "Фулбоди", source: "self", archived_at: null });
    expect(full!.items.map((i) => i.exercise.id)).toEqual([bench, squat]);
    expect(full!.items[0].planExercise.note).toBe("узкий хват");
    expect(full!.items[1].sets).toHaveLength(4);
    expect((await plansRepo.exerciseCounts()).get(id)).toBe(2);
  });

  it("edits keep ids of kept rows, delete removed rows and reorder", async () => {
    const id = await plansRepo.save({
      name: "А",
      items: [
        { exercise_id: bench, note: null, sets: sets(3, 40, 10) },
        { exercise_id: squat, note: null, sets: sets(2, 50, 8) },
      ],
    });
    const before = (await plansRepo.getFull(id))!;
    const [b, s] = before.items;
    const untouchedSet = s.sets[0];

    await plansRepo.save({
      id,
      name: "А",
      items: [
        // squat moved first, one of its sets kept as is
        { id: s.planExercise.id, exercise_id: squat, note: null, sets: [{ ...untouchedSet }] },
        // bench: first set changed, third removed
        {
          id: b.planExercise.id,
          exercise_id: bench,
          note: null,
          sets: [{ ...b.sets[0], weight: 42.5 }, { ...b.sets[1] }],
        },
      ],
    });

    const after = (await plansRepo.getFull(id))!;
    expect(after.items.map((i) => i.planExercise.id)).toEqual([s.planExercise.id, b.planExercise.id]);
    expect(after.items[0].sets.map((x) => x.id)).toEqual([untouchedSet.id]);
    expect(after.items[0].sets[0].updated_at).toBe(untouchedSet.updated_at);
    expect(after.items[1].sets.map((x) => x.weight)).toEqual([42.5, 40]);
    expect(after.items[1].sets.map((x) => x.id)).toEqual([b.sets[0].id, b.sets[1].id]);

    const db = await getDb();
    expect(await db.get("plan_sets", b.sets[2].id)).toBeUndefined();
    expect(await db.get("plan_sets", s.sets[1].id)).toBeUndefined();
  });

  it("copies with new ids and archives without touching the original", async () => {
    const original = planSeedId("plan_glutes_back");
    const copyId = await plansRepo.copy(original);
    const [a, c] = await Promise.all([plansRepo.getFull(original), plansRepo.getFull(copyId)]);
    expect(c!.plan.name).toBe("Ягодицы / спина (копия)");
    expect(c!.items).toHaveLength(a!.items.length);
    expect(c!.items[0].planExercise.id).not.toBe(a!.items[0].planExercise.id);
    expect(c!.items[5].sets.map((x) => x.weight)).toEqual(a!.items[5].sets.map((x) => x.weight));

    await plansRepo.archive(original);
    expect((await plansRepo.list()).map((p) => p.id)).not.toContain(original);
    expect((await plansRepo.listArchived()).map((p) => p.id)).toEqual([original]);
    expect(await plansRepo.getFull(original)).toBeDefined();
  });

  it("rejects an empty name and writes nothing", async () => {
    const before = (await plansRepo.list()).length;
    await expect(plansRepo.save({ name: "  ", items: [] })).rejects.toThrow("Введите название плана");
    expect(await plansRepo.list()).toHaveLength(before);
  });
});

describe("transactions and change events", () => {
  it("notify subscribers with the written stores", async () => {
    const seen: string[][] = [];
    const off = onChange((stores) => seen.push([...stores].sort()));
    await settingsRepo.update({ height_cm: 164 });
    off();
    expect(seen).toEqual([["settings"]]);
    expect((await settingsRepo.get()).height_cm).toBe(164);
  });

  it("roll back all writes when the function throws", async () => {
    await expect(
      withTx(["settings", "progressions"], "readwrite", async (tx) => {
        await tx.objectStore("progressions").put(newEntity({ name: "Подтягивания" }));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await (await getDb()).count("progressions")).toBe(0);
  });
});

describe("measurementsRepo", () => {
  it("adds a user type at the end and rejects duplicates", async () => {
    const t = await measurementsRepo.createType({ name: "Плечо", unit: "см" });
    const types = await measurementsRepo.listTypes();
    expect(types.at(-1)!.id).toBe(t.id);
    expect(t.position).toBe(SEED_MEASUREMENT_TYPES.length);
    await expect(measurementsRepo.createType({ name: "талия", unit: "см" })).rejects.toThrow("уже есть");
  });
});
