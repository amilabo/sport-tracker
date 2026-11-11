import { describe, expect, it } from "vitest";
import type { Exercise, WorkoutSet } from "../types";
import { progressSuggestion, type OptionsItem, type PastLine } from "./progression-options";
import { cleanCeiling, cleanStep, repCeiling, stepOf } from "./progress-settings";

type Ex = OptionsItem["exercise"];
const EX: Ex = { log_type: "weight_reps", equipment: "machine" };
const WE = { skipped: false, replaced_exercise_id: null };
const day = (d: number) => new Date(Date.UTC(2026, 9, 1 + d, 10)).toISOString();

/** `n` planned sets at weight × reps; `done` — what was done (default: the plan). */
function sets(n: number, weight: number | null, reps: number, done: (number | null)[] = Array(n).fill(reps), doneWeight = weight): WorkoutSet[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    workout_exercise_id: "we",
    position: i,
    plan_set_id: `p${i}`,
    target_weight: weight,
    target_reps: reps,
    target_duration_sec: null,
    target_speed_kmh: null,
    weight: doneWeight,
    reps: done[i],
    duration_sec: null,
    speed_kmh: null,
    done_at: done[i] === null ? null : day(0),
    created_at: day(0),
    updated_at: day(0),
    is_demo: false,
  })) as unknown as WorkoutSet[];
}
const item = (s: WorkoutSet[], ex: Partial<Ex> = {}): OptionsItem => ({ we: WE, exercise: { ...EX, ...ex }, sets: s });
const past = (d: number, s: WorkoutSet[]): PastLine => ({ started_at: day(d), we: WE, sets: s });
const brief = (r: ReturnType<typeof progressSuggestion>) =>
  r && { reason: r.reason, options: r.options.map((o) => `${o.kind}:${o.to.sets}×${o.to.reps}×${o.to.weight}`) };

describe("progressSuggestion (stage 51а)", () => {
  it("two workouts at the plan, below the ceiling: weight first by default, +1 rep second", () => {
    expect(brief(progressSuggestion(item(sets(3, 40, 14)), day(7), [past(3, sets(3, 40, 14))]))).toEqual({
      reason: "double",
      options: ["weight:3×14×42.5", "reps:3×15×40"],
    });
  });

  it("the last choice goes first; own step 5 kg", () => {
    expect(brief(progressSuggestion(item(sets(3, 40, 14), { progress_prefer: "reps", weight_step: 5 }), day(7), [past(3, sets(3, 40, 14))]))).toEqual({
      reason: "double",
      options: ["reps:3×15×40", "weight:3×14×45"],
    });
  });

  it("at the ceiling: one more set, or heavier with 3 reps fewer", () => {
    const r = progressSuggestion(item(sets(3, 50, 15), { progress_prefer: "reps" }), day(7), [past(3, sets(3, 50, 15))]);
    expect(brief(r)).toEqual({ reason: "ceiling", options: ["set:4×15×50", "weight_reset:3×12×52.5"] });
    // Own ceiling 16: 15 is still below it.
    expect(brief(progressSuggestion(item(sets(3, 50, 15), { rep_ceiling: 16 }), day(7), [past(3, sets(3, 50, 15))]))?.options).toEqual([
      "weight:3×15×52.5",
      "reps:3×16×50",
    ]);
  });

  it("«на каждую сторону»: +1 per side is +2 to the sum, the ceiling is 15 per side", () => {
    const ex = { per_side: true, progress_prefer: "reps" as const, equipment: "dumbbells" as const };
    expect(brief(progressSuggestion(item(sets(3, 8, 20), ex), day(7), [past(3, sets(3, 8, 20))]))?.options).toEqual(["reps:3×22×8", "weight:3×20×9"]);
    expect(brief(progressSuggestion(item(sets(3, 8, 30), ex), day(7), [past(3, sets(3, 8, 30))]))?.options).toEqual(["set:4×30×8", "weight_reset:3×24×9"]);
    expect(repCeiling({ per_side: true, rep_ceiling: 16 })).toBe(32);
  });

  it("stall: the same line 4 workouts and 21+ days — reps, set and weight", () => {
    // Previous workout not fully done — no double progression, but the plan has not changed since day 0.
    const line = [past(14, sets(3, 35, 12, [12, 12, 10])), past(7, sets(3, 35, 12)), past(0, sets(3, 35, 12))];
    const r = progressSuggestion(item(sets(3, 35, 12)), day(21), line);
    expect(brief(r)).toEqual({ reason: "stall", options: ["weight:3×12×37.5", "reps:3×13×35", "set:4×12×35"] });
    expect(r).toMatchObject({ runs: 4, since: day(0) });
    // 20 days — not yet.
    expect(progressSuggestion(item(sets(3, 35, 12)), day(20), line)).toBeNull();
    // A changed line breaks the run.
    expect(progressSuggestion(item(sets(3, 35, 12)), day(21), [line[0], line[1], past(0, sets(3, 32.5, 12))])).toBeNull();
  });

  it("only «раз»: no weight options", () => {
    expect(brief(progressSuggestion(item(sets(4, null, 20), { log_type: "reps" }), day(7), [past(3, sets(4, null, 20))]))?.options).toEqual(["reps:4×21×null"]);
    // Ceiling 30 by default for «только раз».
    expect(brief(progressSuggestion(item(sets(4, null, 30), { log_type: "reps" }), day(7), [past(3, sets(4, null, 30))]))?.options).toEqual(["set:5×30×null"]);
  });

  it("heavier done today — that weight is offered", () => {
    expect(brief(progressSuggestion(item(sets(3, 40, 14, [14, 14, 14], 45)), day(7), [past(3, sets(3, 40, 14))]))?.options[0]).toBe("weight:3×14×45");
  });

  it("nothing: today not in full, previous not at the plan, pyramid, replaced, cardio", () => {
    const prev = [past(3, sets(3, 40, 14))];
    expect(progressSuggestion(item(sets(3, 40, 14, [14, 14, 13])), day(7), prev)).toBeNull();
    expect(progressSuggestion(item(sets(3, 40, 14)), day(7), [past(3, sets(3, 40, 14, [14, 12, 14]))])).toBeNull();
    expect(progressSuggestion(item(sets(3, 40, 14)), day(7), [])).toBeNull();
    const pyramid = sets(3, 40, 14);
    pyramid[2] = { ...pyramid[2], target_weight: 45, weight: 45 };
    expect(progressSuggestion(item(pyramid), day(7), prev)).toBeNull();
    expect(progressSuggestion({ ...item(sets(3, 40, 14)), replaced: true }, day(7), prev)).toBeNull();
    expect(progressSuggestion(item(sets(3, 40, 14), { log_type: "cardio" as Exercise["log_type"] }), day(7), prev)).toBeNull();
  });

  it("settings: clean values and defaults", () => {
    expect(cleanCeiling(16)).toBe(16);
    expect(cleanCeiling(3)).toBeNull();
    expect(cleanCeiling("15")).toBeNull();
    expect(cleanStep(5)).toBe(5);
    expect(cleanStep(0)).toBeNull();
    expect(stepOf({ equipment: "cable" })).toBe(2.5);
    expect(stepOf({ equipment: "cable", weight_step: 5 })).toBe(5);
    expect(stepOf({ equipment: "cable", weight_step: -1 })).toBe(2.5);
  });
});
