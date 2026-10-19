import { describe, expect, it } from "vitest";
import { groupSessions } from "./body";
import { compareGroups, compareType, composition, minusMonths, periodDates } from "./body-compare";
import type { Measurement, MeasurementType } from "./types";

const type = (id: string, key: string | null, unit: string, computed: MeasurementType["computed"] = null, base: string | null = null) =>
  ({ id, key, name: id, unit, computed, base_type_id: base, archived_at: null }) as MeasurementType;
const TYPES = [
  type("w", "weight", "кг"),
  type("bmi", "bmi", "", "bmi"),
  type("fat", "fat_kg", "кг"),
  type("fatp", "fat_pct", "%", "percent_of_weight", "fat"),
  type("mus", "muscle_kg", "кг"),
  type("waist", "waist", "см"),
  type("own", null, "см"),
];
const [W, BMI, FAT, , , WAIST] = TYPES;
const m = (date: string, typeId: string, value: number) => ({ date, measurement_type_id: typeId, value }) as Measurement;

// Like the club history: scales on most dates, the tape only on some.
const sessions = groupSessions([
  m("2026-05-12", "w", 69.1), m("2026-05-12", "fat", 21), m("2026-05-12", "mus", 26.6),
  m("2026-06-16", "w", 68.9), m("2026-06-16", "fat", 20.5), m("2026-06-16", "mus", 26.7),
  m("2026-07-21", "w", 69.5), m("2026-07-21", "waist", 74),
  m("2026-09-08", "w", 68.9), m("2026-09-08", "fat", 19.3), m("2026-09-08", "mus", 27.4),
  m("2026-09-29", "w", 68.5), m("2026-09-29", "fat", 20.1), m("2026-09-29", "mus", 26.7), m("2026-09-29", "waist", 72.5),
]);

describe("minusMonths", () => {
  it("steps back calendar months and clamps the day", () => {
    expect(minusMonths("2026-09-29", 3)).toBe("2026-06-29");
    expect(minusMonths("2026-02-15", 3)).toBe("2025-11-15");
    expect(minusMonths("2026-05-31", 3)).toBe("2026-02-28");
  });
});

describe("periodDates", () => {
  it("«Прошлый» — the previous session", () => {
    expect(periodDates(sessions, "last")).toEqual({ a: "2026-09-08", b: "2026-09-29" });
  });

  it("«3 мес» — the latest session at least 3 months back; «С начала» — the first one", () => {
    expect(periodDates(sessions, "3m")).toEqual({ a: "2026-06-16", b: "2026-09-29" });
    expect(periodDates(sessions, "all")).toEqual({ a: "2026-05-12", b: "2026-09-29" });
  });

  it("«3 мес» with a shorter history takes the first session", () => {
    expect(periodDates(sessions.slice(0, 3), "3m")).toEqual({ a: "2026-07-21", b: "2026-09-29" });
  });

  it("«Даты» — the chosen pair; «было» must be earlier", () => {
    expect(periodDates(sessions, "custom", { a: "2026-06-16", b: "2026-09-08" })).toEqual({ a: "2026-06-16", b: "2026-09-08" });
    expect(periodDates(sessions, "custom", { a: "2026-09-29", b: "2026-09-08" })).toEqual({ a: null, b: "2026-09-08" });
  });

  it("one session — nothing to compare with", () => {
    expect(periodDates(sessions.slice(0, 1), "last")).toEqual({ a: null, b: "2026-09-29" });
    expect(periodDates([], "all")).toEqual({ a: null, b: null });
  });
});

describe("compareType", () => {
  it("weight between the period dates", () => {
    const r = compareType(W, sessions, TYPES, 164, periodDates(sessions, "all"));
    expect(r.a).toMatchObject({ value: 69.1, date: "2026-05-12" });
    expect(r.b).toMatchObject({ value: 68.5, date: "2026-09-29" });
    expect(r.delta).toBe(-0.6);
    expect(r.series).toHaveLength(5);
  });

  it("a type measured later than «было» starts from its first value", () => {
    const r = compareType(WAIST, sessions, TYPES, 164, periodDates(sessions, "all"));
    expect(r.a).toMatchObject({ value: 74, date: "2026-07-21" });
    expect(r.delta).toBe(-1.5);
  });

  it("a type missing on «стало» takes its last value before it", () => {
    const r = compareType(FAT, sessions, TYPES, 164, { a: "2026-05-12", b: "2026-07-21" });
    expect(r.b).toMatchObject({ value: 20.5, date: "2026-06-16" });
    expect(r.delta).toBe(-0.5);
  });

  it("no change when both sides fall on the same value", () => {
    const r = compareType(WAIST, sessions, TYPES, 164, { a: "2026-07-21", b: "2026-09-08" });
    expect(r.a).toBeNull();
    expect(r.delta).toBeNull();
  });

  it("BMI is computed and marked so; none without height", () => {
    expect(compareType(BMI, sessions, TYPES, 164, periodDates(sessions, "last")).b).toEqual({ value: 25.5, date: "2026-09-29", computed: true });
    expect(compareType(BMI, sessions, TYPES, null, periodDates(sessions, "last")).b).toBeNull();
  });
});

describe("compareGroups", () => {
  it("built-in groups in screen order, only types that have values", () => {
    const groups = compareGroups(TYPES, sessions, 164, periodDates(sessions, "last"));
    expect(groups.map((g) => [g.title, g.rows.map((r) => r.type.id)])).toEqual([
      ["Масса", ["w", "bmi"]],
      ["Состав", ["fat", "fatp", "mus"]],
      ["Объёмы", ["waist"]],
    ]);
  });
});

describe("composition", () => {
  it("weight = fat + muscle + the rest, with changes in kg", () => {
    const c = composition(TYPES, sessions, periodDates(sessions, "last"))!;
    expect(c.weight).toBe(68.5);
    expect(c.parts.map((p) => [p.key, p.kg, Math.round(p.pct * 10) / 10, p.delta])).toEqual([
      ["fat", 20.1, 29.3, 0.8],
      ["muscle", 26.7, 39, -0.7],
      ["rest", 21.7, 31.7, -0.5],
    ]);
  });

  it("skips sessions with weight only", () => {
    const c = composition(TYPES, sessions, { a: "2026-06-16", b: "2026-07-21" })!;
    expect(c.date).toBe("2026-06-16");
    expect(c.parts.every((p) => p.delta === null)).toBe(true);
  });
});
