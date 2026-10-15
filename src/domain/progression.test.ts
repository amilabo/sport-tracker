import { describe, expect, it } from "vitest";
import { chainTimeline, insertLevel, levelInfo, moveLevel, type ChainSession } from "./progression";
import type { Exercise, WorkoutSet } from "./types";

const ex = (id: string, log_type: Exercise["log_type"] = "reps") => ({ id, name: id, log_type }) as Exercise;
const s = (exerciseId: string, date: string, v: Partial<WorkoutSet>): ChainSession => ({
  workoutId: `${exerciseId}-${date}`,
  startedAt: `${date}T07:00:00.000Z`,
  exerciseId,
  sets: [{ weight: null, reps: null, duration_sec: null, speed_kmh: null, done_at: "x", ...v } as WorkoutSet],
});

describe("levels", () => {
  it("inserts easier before and harder after the anchor", () => {
    expect(insertLevel(["b"], "b", "a", "easier")).toEqual(["a", "b"]);
    expect(insertLevel(["a", "c"], "a", "b", "harder")).toEqual(["a", "b", "c"]);
  });

  it("moves a level and stays put at the ends", () => {
    expect(moveLevel(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveLevel(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });
});

describe("chain timeline", () => {
  const members = [ex("Гравитрон", "bodyweight_plus"), ex("С резинкой"), ex("Подтягивания")];
  const sessions = [
    s("Гравитрон", "2026-03-03", { weight: -35, reps: 10 }),
    s("Гравитрон", "2026-07-07", { weight: -20, reps: 12 }),
    s("С резинкой", "2026-07-10", { reps: 8 }),
    s("С резинкой", "2026-10-07", { reps: 12 }),
  ];

  it("newest first, a transition mark under the first workout of a harder level", () => {
    const items = chainTimeline(members, sessions);
    expect(items.map((i) => (i.kind === "row" ? `${i.session.startedAt.slice(0, 10)} ${i.exercise.name}` : `→ ${i.exercise.name}`))).toEqual([
      "2026-10-07 С резинкой",
      "2026-07-10 С резинкой",
      "→ С резинкой",
      "2026-07-07 Гравитрон",
      "2026-03-03 Гравитрон",
    ]);
  });

  it("levels: passed, current (done last), goal; ranges per variant in its own units", () => {
    const info = levelInfo(members, sessions);
    expect(info.map((l) => [l.level, l.state, l.range])).toEqual([
      [1, "passed", "−35 кг → −20 кг"],
      [2, "current", "8 раз → 12 раз"],
      [3, "goal", null],
    ]);
  });

  it("starting in the middle of a chain gives no mark for the first level done", () => {
    const items = chainTimeline(members, [s("С резинкой", "2026-07-10", { reps: 8 })]);
    expect(items.some((i) => i.kind === "transition")).toBe(false);
  });
});
