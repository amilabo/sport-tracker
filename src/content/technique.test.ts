import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/db/seed/catalog";
import { exerciseSeedId } from "@/db/seed";
import { cleanDescription } from "@/domain/text";
import { CATALOG_DESCRIPTIONS } from "./exercise-descriptions";
import { techniqueHint, techniqueOf, upperFirst } from "./technique";

describe("catalog descriptions", () => {
  it("cover every starter exercise and nothing else", () => {
    expect(Object.keys(CATALOG_DESCRIPTIONS).sort()).toEqual(SEED_EXERCISES.map((e) => e.key).sort());
  });

  it("have steps and «Важно» without markdown leftovers", () => {
    for (const [key, d] of Object.entries(CATALOG_DESCRIPTIONS)) {
      expect(d.steps.length, key).toBeGreaterThanOrEqual(3);
      for (const text of [...d.steps, d.important]) {
        expect(text.trim(), key).not.toBe("");
        expect(text, key).not.toMatch(/\*|^\d+\.|новое/);
      }
    }
  });
});

describe("techniqueOf", () => {
  const catalog = { id: exerciseSeedId("lat_pulldown"), is_builtin: true, description: null };

  it("finds a catalog exercise by its seed id, even renamed", () => {
    const t = techniqueOf(catalog);
    expect(t?.kind).toBe("catalog");
    expect(t && techniqueHint(t)).toBe("Важно: не тяните за голову и не раскачивайтесь корпусом.");
  });

  it("uses the person's text for an own exercise and nothing when it is empty", () => {
    expect(techniqueOf({ id: "x", is_builtin: false, description: "  \n Локти прижаты\nВторая строка" })).toEqual({
      kind: "own",
      text: "Локти прижаты\nВторая строка",
    });
    expect(techniqueOf({ id: "x", is_builtin: false, description: "   " })).toBeNull();
    expect(techniqueOf({ id: "x", is_builtin: false })).toBeNull();
  });

  it("own hint is the first non-empty line", () => {
    expect(techniqueHint({ kind: "own", text: "Локти прижаты\nВторая" })).toBe("Локти прижаты");
  });

  it("upperFirst keeps the rest", () => {
    expect(upperFirst("локти неподвижны — Смит")).toBe("Локти неподвижны — Смит");
  });
});

describe("cleanDescription", () => {
  it("trims lines, keeps one empty line between paragraphs, empty → null", () => {
    expect(cleanDescription("  1.  Сядьте \r\n\r\n\r\n2. Жмите  ")).toBe("1. Сядьте\n\n2. Жмите");
    expect(cleanDescription(" \n ")).toBeNull();
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("а".repeat(2500))).toHaveLength(2000);
  });
});
