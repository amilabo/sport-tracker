import { describe, expect, it } from "vitest";
import { groupSessions, parseBodyValue, seriesOf, tileLine, valueOf } from "./body";
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
const [W, BMI, FAT, FATP, WAIST] = TYPES;

describe("body values", () => {
  const sessions = groupSessions([
    m("2026-09-08", "w", 68.9), m("2026-09-08", "fat", 19.3), m("2026-09-08", "fatp", 28.01),
    m("2026-09-29", "w", 68.5), m("2026-09-29", "fat", 20.1), m("2026-09-29", "waist", 72.5),
  ]);

  it("groups by date, newest first", () => {
    expect(sessions.map((s) => s.date)).toEqual(["2026-09-29", "2026-09-08"]);
  });

  it("BMI from weight and height; none without height", () => {
    expect(valueOf(BMI, sessions[0], TYPES, 164)).toEqual({ value: 25.5, computed: true });
    expect(valueOf(BMI, sessions[0], TYPES, null)).toBeNull();
  });

  it("a typed percentage wins; otherwise it is computed from kg and weight", () => {
    expect(valueOf(FATP, sessions[1], TYPES, 164)).toEqual({ value: 28.01, computed: false });
    expect(valueOf(FATP, sessions[0], TYPES, 164)).toEqual({ value: 29.3, computed: true });
  });

  it("tile: latest value and the change against the previous session", () => {
    expect(tileLine(W, sessions, TYPES, 164)).toMatchObject({ value: 68.5, delta: -0.4 });
    expect(tileLine(FAT, sessions, TYPES, 164)).toMatchObject({ value: 20.1, delta: 0.8 });
    // Only in the latest session: a value, no arrow.
    expect(tileLine(WAIST, sessions, TYPES, 164)).toMatchObject({ value: 72.5, delta: null });
  });

  it("series oldest first", () => {
    expect(seriesOf(FAT, sessions, TYPES, 164).map((p) => p.value)).toEqual([19.3, 20.1]);
  });
});

describe("parseBodyValue", () => {
  it("empty is not saved, typos and impossible values are refused", () => {
    expect(parseBodyValue(W, "")).toBeNull();
    expect(parseBodyValue(W, "68,5")).toBe(68.5);
    expect(parseBodyValue(W, "6о")).toBeUndefined();
    expect(parseBodyValue(W, "-1")).toBeUndefined();
    expect(parseBodyValue(FATP, "120")).toBeUndefined();
  });
});
