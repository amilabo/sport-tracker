import { describe, expect, it } from "vitest";
import { overText, restSummary, restUpdates } from "./rest-summary";
import type { RestSnapshot } from "./types";

const AT = "2026-10-30T10:00:00.000Z";
const SNAP: RestSnapshot = { format: "rest", rest_set_sec: 120, rest_exercise_sec: 180 };
type S = { rest_sec?: number; rest_target_sec?: number; rest_approx?: boolean; done?: boolean };
const sets = (list: S[]) => list.map((s) => ({ done_at: s.done === false ? null : AT, ...s }));
const item = (id: string, list: S[], extra: { circuit_id?: string; rest_set_sec?: number | null; replaced?: unknown } = {}) => ({
  we: { id, skipped: false, plan_exercise_id: `pe-${id}`, rest_set_sec: extra.rest_set_sec ?? null, circuit_id: extra.circuit_id },
  exercise: { name: id },
  replaced: extra.replaced ?? null,
  sets: sets(list),
});

describe("restSummary", () => {
  it("nothing recorded — no block", () => {
    expect(restSummary([item("a", [{}, {}])])).toBeNull();
  });

  it("totals, average over the plan by exact rests, long ones and «≈»", () => {
    const r = restSummary([
      item("a", [{ rest_sec: 0, rest_target_sec: 180 }, { rest_sec: 140, rest_target_sec: 120 }, { rest_sec: 170, rest_target_sec: 120 }]),
      item("b", [{ rest_sec: 200, rest_target_sec: 120, rest_approx: true }, { rest_sec: 99, done: false }]),
    ])!;
    expect(r).toEqual({ restSec: 510, count: 4, approxCount: 1, avgOverSec: Math.round((-180 + 20 + 50) / 3), longCount: 1 });
    expect(overText(23)).toBe("Отдыхали в среднем на 0:23 дольше плана");
    expect(overText(-40)).toBe("Отдыхали в среднем на 0:40 короче плана");
    expect(overText(3)).toBe("Отдыхали как в плане");
  });
});

describe("restUpdates", () => {
  it("suggests the measured rest between sets, rounded to 15 s", () => {
    const u = restUpdates([item("Рывок", [{ rest_sec: 300 }, { rest_sec: 130 }, { rest_sec: 142 }])], SNAP);
    expect(u).toEqual([{ key: "rest:Рывок", exerciseName: "Рывок", planExerciseId: "pe-Рывок", fromSec: 120, toSec: 135 }]);
  });

  it("not for a small difference, one measurement, «≈», circuits or replacements", () => {
    const close = [{}, { rest_sec: 125 }, { rest_sec: 130 }];
    expect(restUpdates([item("a", close)], SNAP)).toEqual([]);
    expect(restUpdates([item("a", [{}, { rest_sec: 200 }])], SNAP)).toEqual([]);
    expect(restUpdates([item("a", [{}, { rest_sec: 200, rest_approx: true }, { rest_sec: 200, rest_approx: true }])], SNAP)).toEqual([]);
    const far = [{}, { rest_sec: 200 }, { rest_sec: 200 }];
    expect(restUpdates([item("a", far, { circuit_id: "c" })], SNAP)).toEqual([]);
    expect(restUpdates([item("a", far, { replaced: {} })], SNAP)).toEqual([]);
    expect(restUpdates([item("a", far)], undefined)).toEqual([]);
  });

  it("compares with the exercise's own rest", () => {
    expect(restUpdates([item("a", [{}, { rest_sec: 90 }, { rest_sec: 90 }], { rest_set_sec: 60 })], SNAP)[0]).toMatchObject({ fromSec: 60, toSec: 90 });
  });
});
