import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/db/seed/catalog";
import { exerciseSeedId } from "@/db/seed";
import { CATALOG_SECONDARY, cleanSecondary, muscleGroupsOf, SECONDARY_MAX } from "./exercise-muscles";

describe("catalog secondary groups", () => {
  it("cover every starter exercise and nothing else", () => {
    expect(Object.keys(CATALOG_SECONDARY).sort()).toEqual(SEED_EXERCISES.map((e) => e.key).sort());
  });

  it("never repeat the main group, never cardio or whole body, at most two", () => {
    for (const e of SEED_EXERCISES) {
      const list = CATALOG_SECONDARY[e.key];
      expect(list.length, e.key).toBeLessThanOrEqual(SECONDARY_MAX);
      expect(list, e.key).not.toContain(e.muscle_group);
      expect(list.some((g) => g === "cardio" || g === "full_body"), e.key).toBe(false);
      if (e.muscle_group === "cardio" || e.muscle_group === "full_body") expect(list, e.key).toEqual([]);
    }
  });

  it("are found by the seed id; own exercises use their own choice", () => {
    const rdl = SEED_EXERCISES.find((e) => e.key === "romanian_deadlift")!;
    expect(muscleGroupsOf({ id: exerciseSeedId(rdl.key), is_builtin: true, muscle_group: rdl.muscle_group })).toEqual({ main: "legs", secondary: ["glutes"] });
    const row = SEED_EXERCISES.find((e) => e.key === "seated_cable_row")!;
    expect(muscleGroupsOf({ id: exerciseSeedId(row.key), is_builtin: true, muscle_group: "back" }).secondary).toEqual(["arms", "shoulders"]);
    expect(muscleGroupsOf({ id: "own", is_builtin: false, muscle_group: "chest", secondary_groups: ["arms", "chest", "back"] }).secondary).toEqual(["arms", "back"]);
    expect(muscleGroupsOf({ id: "own", is_builtin: false, muscle_group: "cardio", secondary_groups: ["legs"] }).secondary).toEqual([]);
  });

  it("the form keeps two, other than the main group", () => {
    expect(cleanSecondary("back", ["arms", "back", "arms", "shoulders", "legs"])).toEqual(["arms", "shoulders"]);
    expect(cleanSecondary("full_body", ["legs"])).toEqual([]);
    expect(cleanSecondary("chest", null)).toEqual([]);
  });
});
