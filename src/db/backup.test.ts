import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backupCounts, parseBackup, type BackupFile } from "@/domain/backup";
import { newEntity, touch } from "@/domain/entity";
import { DomainError, STORE_NAMES, type Exercise, type Workout } from "@/domain/types";
import { getDb, resetDbForTests } from "./client";
import { backupRepo } from "./repos/backup";
import { exercisesRepo } from "./repos/exercises";
import { measurementsRepo } from "./repos/measurements";
import { progressionsRepo } from "./repos/progressions";
import { settingsRepo } from "./repos/settings";
import { workoutsRepo } from "./repos/workouts";
import { exerciseSeedId, planSeedId } from "./seed";

const LEGS = planSeedId("plan_legs_chest_arms");

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

const roundTrip = (file: BackupFile) => parseBackup(JSON.stringify(file));

async function finishedWorkout(planId: string | null = LEGS): Promise<string> {
  const r = await workoutsRepo.start(planId);
  if (r.status !== "started") throw new Error("expected start");
  const full = (await workoutsRepo.getFull(r.id))!;
  const at = full.workout.started_at;
  await workoutsRepo.put({
    sets: full.items.flatMap((i) => i.sets.map((s) => touch(s, { done_at: at }))),
    workout: touch(full.workout, { status: "finished", finished_at: at, plan_update_prompted: true }),
  });
  return r.id;
}

describe("parseBackup", () => {
  it("rejects files that are not a backup of this app, with a message for the user", () => {
    expect(() => parseBackup("not json")).toThrow(DomainError);
    expect(() => parseBackup(JSON.stringify({ app: "other", format: 1, data: {} }))).toThrow("не файл копии");
    expect(() => parseBackup(JSON.stringify({ app: "sport-tracker", format: 99, data: {} }))).toThrow("более новой версии");
    expect(() => parseBackup(JSON.stringify({ app: "sport-tracker", format: 1, data: { workouts: [{ id: 1 }] } }))).toThrow("повреждён");
  });

  it("accepts a file with a BOM and counts real records, not demo ones", () => {
    const text = "﻿" + JSON.stringify({
      app: "sport-tracker",
      format: 1,
      data: { workouts: [{ id: "a", updated_at: "x" }, { id: "b", updated_at: "x", is_demo: true }], unknown_store: [1] },
    });
    const file = parseBackup(text);
    expect(backupCounts(file)).toEqual({ workouts: 1, plans: 0, exercises: 0, measurements: 0 });
    expect(Object.keys(file.data)).toEqual(["workouts"]);
  });
});

describe("backupRepo", () => {
  it("export → «Заменить всё» on a clean phone restores everything one to one", async () => {
    await finishedWorkout();
    const before = await backupRepo.exportAll();
    await resetDbForTests();
    await exercisesRepo.create({ name: "Лишнее упражнение", muscle_group: "arms", equipment: "other", log_type: "reps" });

    await backupRepo.import(roundTrip(before), "replace");
    const after = await backupRepo.exportAll();
    for (const name of STORE_NAMES) expect(after.data[name], name).toEqual(before.data[name]);
  });

  it("a file with every kind of record (.json or .txt) restores all of it, with «Заменить всё» and with «Объединить»", async () => {
    // Workouts, a measurement with a custom type, a progression, a custom exercise, height.
    await finishedWorkout();
    const own = await measurementsRepo.createType({ name: "Плечо", unit: "см" });
    const types = await measurementsRepo.listTypes();
    const weight = types.find((t) => t.key === "weight")!;
    await measurementsRepo.saveSession("2026-10-05", new Map([[weight.id, 69.4], [own.id, 31]]));
    const variant = await exercisesRepo.create({ name: "Гравитрон узким хватом", muscle_group: "back", equipment: "machine", log_type: "bodyweight_plus" });
    await progressionsRepo.link(exerciseSeedId("assisted_pull_ups"), variant.id, "harder", "Подтягивания");
    await settingsRepo.update({ height_cm: 164 });
    const before = await backupRepo.exportAll();
    for (const name of STORE_NAMES) expect(before.data[name]?.length, `${name} has records`).toBeGreaterThan(0);

    // The share sheet on Android sends the same text with a .txt name: the content is what is read.
    const text = JSON.stringify(before);
    for (const mode of ["replace", "merge"] as const) {
      await resetDbForTests();
      await backupRepo.import(parseBackup(text), mode);
      const after = await backupRepo.exportAll();
      for (const name of STORE_NAMES) {
        if (name === "settings") continue;
        expect(after.data[name], `${mode}: ${name}`).toEqual(before.data[name]);
      }
      expect((await settingsRepo.get()).height_cm, `${mode}: height`).toBe(164);
    }
  });

  it("«Объединить» keeps the phone's own height", async () => {
    await settingsRepo.update({ height_cm: 170 });
    const file = roundTrip({ app: "sport-tracker", format: 1, schema_version: 1, exported_at: "", data: { settings: [{ ...(await settingsRepo.get()), height_cm: 164 }] } });
    await backupRepo.import(file, "merge");
    expect((await settingsRepo.get()).height_cm).toBe(170);
  });

  it("«Объединить» adds missing workouts and keeps the newer version of shared records", async () => {
    const w1 = await finishedWorkout();
    const file = roundTrip(await backupRepo.exportAll());
    await resetDbForTests();
    const w2 = await finishedWorkout();
    // Renamed on the phone after the file was made: the phone's version is newer and stays.
    const pec = (await exercisesRepo.get(exerciseSeedId("pec_deck")))!;
    await exercisesRepo.update(pec.id, { name: "Пек-дек" });

    const r = await backupRepo.import(file, "merge");
    expect(r.workoutsAdded).toBe(1);
    const ids = (await (await getDb()).getAll("workouts")).map((w) => w.id).sort();
    expect(ids).toEqual([w1, w2].sort());
    expect((await exercisesRepo.get(pec.id))!.name).toBe("Пек-дек");

    // Importing the same file again changes nothing.
    const again = await backupRepo.import(file, "merge");
    expect([again.added, again.updated]).toEqual([0, 0]);
  });

  it("«Объединить» fills a measurement day from a file: one value per date and measurement, the newer edit wins", async () => {
    const types = await measurementsRepo.listTypes();
    const id = (key: string) => types.find((t) => t.key === key)!.id;
    // Entered on the phone: weight and waist on 01.09.
    await measurementsRepo.saveSession("2026-09-01", new Map([[id("weight"), 70], [id("waist"), 75]]));
    // A file made later (club data) for the same day: weight (other value), fat; and an older waist.
    const at = new Date(Date.now() + 60_000).toISOString();
    const m = (key: string, value: number, updated = at) => ({
      ...newEntity({ date: "2026-09-01", measurement_type_id: id(key), value }, { at: updated }),
    });
    const file = roundTrip({
      app: "sport-tracker", format: 1, schema_version: 1, exported_at: "",
      data: { measurements: [m("weight", 70.6), m("fat_kg", 20.9), m("waist", 74, "2000-01-01T00:00:00.000Z")] },
    });

    const r = await backupRepo.import(file, "merge");
    expect([r.added, r.updated, r.kept]).toEqual([1, 1, 1]);
    const day = (await measurementsRepo.list()).filter((x) => x.date === "2026-09-01");
    const byKey = Object.fromEntries(types.filter((t) => day.some((x) => x.measurement_type_id === t.id)).map((t) => [t.key, day.filter((x) => x.measurement_type_id === t.id).map((x) => x.value)]));
    expect(byKey).toEqual({ weight: [70.6], fat_kg: [20.9], waist: [75] });
  });

  it("renames an imported exercise whose name is taken by another exercise on the phone", async () => {
    await exercisesRepo.create({ name: "Берпи", muscle_group: "full_body", equipment: "bodyweight", log_type: "reps" });
    const theirs: Exercise = newEntity({
      name: "берпи", muscle_group: "full_body", equipment: "bodyweight", log_type: "reps",
      is_builtin: false, archived_at: null, progression_id: null, progression_level: null,
    });
    const file = roundTrip({ app: "sport-tracker", format: 1, schema_version: 1, exported_at: "", data: { exercises: [theirs] } });
    const r = await backupRepo.import(file, "merge");
    expect(r.renamed).toEqual(["берпи (2)"]);
  });

  it("«Объединить» accepts a file with only a program that uses exercises from the starter catalog", async () => {
    const plan = newEntity({ name: "Программа из клуба", source: "coach" as const, archived_at: null });
    const pe = newEntity({ plan_id: plan.id, exercise_id: exerciseSeedId("pec_deck"), position: 0, note: null });
    const ps = newEntity({ plan_exercise_id: pe.id, position: 0, weight: 17.5, reps: 12, duration_sec: null, speed_kmh: null });
    const file = roundTrip({ app: "sport-tracker", format: 1, schema_version: 1, exported_at: "", data: { plans: [plan], plan_exercises: [pe], plan_sets: [ps] } });
    expect(backupCounts(file)).toEqual({ workouts: 0, plans: 1, exercises: 0, measurements: 0 });

    const r = await backupRepo.import(file, "merge");
    expect(r.added).toBe(3);
    const db = await getDb();
    expect((await db.get("plans", plan.id))?.name).toBe("Программа из клуба");
    expect(await db.get("plans", LEGS)).toBeDefined();
  });

  it("refuses a file with dangling references and leaves the phone untouched", async () => {
    const before = await backupRepo.exportAll();
    const orphan = newEntity({ workout_id: "nope", exercise_id: exerciseSeedId("pec_deck"), replaced_exercise_id: null, plan_exercise_id: null, position: 0, skipped: false, note: null });
    const file = roundTrip({ app: "sport-tracker", format: 1, schema_version: 1, exported_at: "", data: { workout_exercises: [orphan] } });
    await expect(backupRepo.import(file, "merge")).rejects.toThrow("Файл неполный");
    expect((await backupRepo.exportAll()).data).toEqual(before.data);
  });

  it("keeps a single workout in progress: the older one is finished", async () => {
    const r1 = await workoutsRepo.start(LEGS);
    if (r1.status !== "started") throw new Error("expected start");
    const file = roundTrip(await backupRepo.exportAll());
    await resetDbForTests();
    const r2 = await workoutsRepo.start(null);
    if (r2.status !== "started") throw new Error("expected start");

    await backupRepo.import(file, "merge");
    const all = await (await getDb()).getAll("workouts");
    const status = (id: string) => all.find((w: Workout) => w.id === id)!.status;
    const [older, newer] = [r1.id, r2.id].sort((a, b) =>
      all.find((w) => w.id === a)!.started_at.localeCompare(all.find((w) => w.id === b)!.started_at),
    );
    expect([status(older), status(newer)]).toEqual(["auto_finished", "in_progress"]);
  });

  it("«Удалить все данные» leaves only the starter set and keeps the theme", async () => {
    await finishedWorkout();
    await exercisesRepo.create({ name: "Берпи", muscle_group: "full_body", equipment: "bodyweight", log_type: "reps" });
    const { settingsRepo } = await import("./repos/settings");
    await settingsRepo.update({ theme_mode: "dark", height_cm: 164, last_export_at: "2026-10-10T10:00:00.000Z" });

    await backupRepo.wipe();
    const db = await getDb();
    expect(await db.count("workouts")).toBe(0);
    expect(await db.count("workout_sets")).toBe(0);
    expect(await db.count("exercises")).toBe(44);
    expect(await db.count("plans")).toBe(2);
    const settings = await settingsRepo.get();
    expect([settings.theme_mode, settings.height_cm, settings.last_export_at]).toEqual(["dark", null, null]);
  });
});
