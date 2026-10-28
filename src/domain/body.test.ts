import { describe, expect, it } from "vitest";
import { groupSessions, parseBodyValue, seriesOf, valueOf } from "./body";
import type { Measurement, MeasurementType } from "./types";

const type = (id: string, key: string | null, unit: string, computed: MeasurementType["computed"] = null, base: string | null = null) =>
  ({ id, key, name: id, unit, computed, base_type_id: base, archived_at: null }) as MeasurementType;
const TYPES = [
  type("w", "weight", "кг"),
  type("bmi", "bmi", "", "bmi"),
  type("fat", "fat_kg", "кг"),
  type("fatp", "fat_pct", "%", "percent_of_weight", "fat"),
  type("waist", "waist", "см"),
];
const m = (date: string, typeId: string, value: number) => ({ date, measurement_type_id: typeId, value }) as Measurement;
const [W, BMI, FAT, FATP] = TYPES;

describe("body values", () => {
  const sessions = groupSessions([
    m("2026-09-08", "w", 64.2), m("2026-09-08", "fat", 18.1), m("2026-09-08", "fatp", 28.19),
    m("2026-09-29", "w", 64), m("2026-09-29", "fat", 18.5), m("2026-09-29", "waist", 71.5),
  ]);

  it("groups by date, newest first", () => {
    expect(sessions.map((s) => s.date)).toEqual(["2026-09-29", "2026-09-08"]);
  });

  it("BMI from weight and height; none without height", () => {
    expect(valueOf(BMI, sessions[0], TYPES, 166)).toEqual({ value: 23.2, computed: true });
    expect(valueOf(BMI, sessions[0], TYPES, null)).toBeNull();
  });

  it("a typed percentage wins; otherwise it is computed from kg and weight", () => {
    expect(valueOf(FATP, sessions[1], TYPES, 166)).toEqual({ value: 28.19, computed: false });
    expect(valueOf(FATP, sessions[0], TYPES, 166)).toEqual({ value: 28.9, computed: true });
  });

  it("series oldest first", () => {
    expect(seriesOf(FAT, sessions, TYPES, 166).map((p) => p.value)).toEqual([18.1, 18.5]);
  });
});

describe("parseBodyValue", () => {
  it("empty is not saved, typos and impossible values are refused", () => {
    expect(parseBodyValue(W, "")).toBeNull();
    expect(parseBodyValue(W, "64,5")).toBe(64.5);
    expect(parseBodyValue(W, "6о")).toBeUndefined();
    expect(parseBodyValue(W, "-1")).toBeUndefined();
    expect(parseBodyValue(FATP, "120")).toBeUndefined();
  });
});
