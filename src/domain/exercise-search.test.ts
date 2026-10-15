import { describe, expect, it } from "vitest";
import { newEntity } from "./entity";
import { canCreateFromQuery, filterExercises, presentGroups } from "./exercise-search";
import type { Exercise, MuscleGroup } from "./types";

const ex = (name: string, muscle_group: MuscleGroup): Exercise =>
  newEntity({
    name,
    muscle_group,
    equipment: "machine",
    log_type: "weight_reps",
    is_builtin: true,
    archived_at: null,
    progression_id: null,
    progression_level: null,
  });

const list = [
  ex("Тяга нижнего блока", "back"),
  ex("Тяга верхнего блока", "back"),
  ex("Румынская становая тяга", "legs"),
  ex("Жим лёжа", "chest"),
];

describe("filterExercises", () => {
  it("matches all words in any order, ignoring case and ё", () => {
    expect(filterExercises(list, "тяга", null)).toHaveLength(3);
    expect(filterExercises(list, "блока ВЕРХ", null).map((e) => e.name)).toEqual(["Тяга верхнего блока"]);
    expect(filterExercises(list, "жим леж", null).map((e) => e.name)).toEqual(["Жим лёжа"]);
  });

  it("combines query with the muscle group", () => {
    expect(filterExercises(list, "тяга", "legs").map((e) => e.name)).toEqual(["Румынская становая тяга"]);
    expect(filterExercises(list, "", "chest")).toHaveLength(1);
  });
});

describe("presentGroups", () => {
  it("keeps canonical order and skips empty groups", () => {
    expect(presentGroups(list)).toEqual(["chest", "back", "legs"]);
  });
});

describe("canCreateFromQuery", () => {
  it("offers creation only for a new non-empty name", () => {
    expect(canCreateFromQuery(list, "  ")).toBe(false);
    expect(canCreateFromQuery(list, "жим лежа")).toBe(false);
    expect(canCreateFromQuery(list, "жим")).toBe(true);
  });
});
