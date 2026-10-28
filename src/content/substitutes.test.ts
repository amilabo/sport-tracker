import { describe, expect, it } from "vitest";
import { exerciseSeedId } from "@/db/seed";
import { SEED_EXERCISES } from "@/db/seed/catalog";
import { CATALOG_SUBSTITUTES, MUSCLES, PATTERNS, RELATIONS } from "./exercise-substitutes";
import { catalogSubsOf } from "./substitutes";

const keys = new Set(SEED_EXERCISES.map((e) => e.key));
const equipment = new Map(SEED_EXERCISES.map((e) => [e.key, e.equipment]));
/** Heavy barbell lifts: never a plain substitute for a light machine exercise. */
const HEAVY = ["deadlift", "barbell_squat", "barbell_overhead_press", "barbell_row"];

describe("substitutes reference", () => {
  it("covers every starter exercise and nothing else", () => {
    expect(Object.keys(CATALOG_SUBSTITUTES).sort()).toEqual([...keys].sort());
  });

  it("has 1–5 valid substitutes per exercise: catalog ones, not itself, no repeats, short notes", () => {
    for (const [key, d] of Object.entries(CATALOG_SUBSTITUTES)) {
      expect(d.subs.length, key).toBeGreaterThanOrEqual(1);
      expect(d.subs.length, key).toBeLessThanOrEqual(5);
      expect(new Set(d.subs.map((s) => s.key)).size, key).toBe(d.subs.length);
      for (const s of d.subs) {
        expect(keys.has(s.key), `${key} → ${s.key}`).toBe(true);
        expect(s.key, key).not.toBe(key);
        expect(RELATIONS, key).toContain(s.relation);
        expect(s.note.length, `${key} → ${s.key}`).toBeLessThanOrEqual(40);
        expect(s.note.trim(), key).not.toBe("");
      }
    }
  });

  it("uses movements and muscles from the dictionaries", () => {
    for (const [key, d] of Object.entries(CATALOG_SUBSTITUTES)) {
      expect(PATTERNS, key).toContain(d.pattern);
      expect(d.primary.length, key).toBeGreaterThan(0);
      for (const m of [...d.primary, ...d.secondary]) expect(MUSCLES, key).toContain(m);
    }
  });

  it("offers heavy barbell lifts only as «сложнее» or «смещает акцент», except to other barbell exercises", () => {
    for (const [key, d] of Object.entries(CATALOG_SUBSTITUTES)) {
      if (equipment.get(key) === "barbell") continue;
      for (const s of d.subs.filter((x) => HEAVY.includes(x.key))) {
        expect(["harder", "angle"], `${key} → ${s.key}`).toContain(s.relation);
      }
    }
  });
});

describe("catalogSubsOf", () => {
  it("finds a catalog exercise by its seed id, even renamed", () => {
    const subs = catalogSubsOf({ id: exerciseSeedId("seated_cable_row"), is_builtin: true });
    expect(subs[0]).toEqual({ id: exerciseSeedId("hammer_row"), relation: "same", note: "тренажёр, упор груди" });
  });

  it("gives nothing for an own exercise", () => {
    expect(catalogSubsOf({ id: exerciseSeedId("seated_cable_row"), is_builtin: false })).toEqual([]);
    expect(catalogSubsOf({ id: "own-1", is_builtin: false })).toEqual([]);
  });
});
