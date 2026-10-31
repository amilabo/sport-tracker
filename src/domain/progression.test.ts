import { describe, expect, it } from "vitest";
import { chainSeries, chainTimeline, insertLevel, levelInfo, moveLevel, type ChainSession } from "./progression";
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

describe("chainSeries (А7)", () => {
  const gravitron = ex("gravitron", "bodyweight_plus");
  const band = ex("band", "reps");
  const pullups = ex("pullups", "reps");
  const sessions = [
    s("gravitron", "2026-05-02", { weight: -40, reps: 8 }),
    s("gravitron", "2026-06-10", { weight: -30, reps: 8 }),
    s("gravitron", "2026-07-18", { weight: -20, reps: 8 }),
    s("band", "2026-07-21", { reps: 5 }),
    s("band", "2026-10-10", { reps: 9 }),
    s("pullups", "2026-10-14", { reps: 3 }),
  ];

  it("a band per level, scaled inside it; less assistance is higher", () => {
    const c = chainSeries([gravitron, band, pullups], sessions);
    expect(c.levels.map((l) => l.points.map((p) => p.norm))).toEqual([[0, 0.5, 1], [0, 1], [0.5]]);
    expect(c.levels[0].points.map((p) => p.value)).toEqual([-40, -30, -20]);
    expect(c.current).toEqual({ level: 3, since: "2026-10-14T07:00:00.000Z" });
    expect(c.from).toBe(new Date("2026-05-02T07:00:00.000Z").getTime());
  });

  it("a level without workouts has no points; no workouts — nothing current", () => {
    const c = chainSeries([gravitron, band, pullups], sessions.slice(0, 3));
    expect(c.levels[2].points).toEqual([]);
    expect(c.current?.level).toBe(1);
    expect(chainSeries([band], [])).toMatchObject({ from: null, to: null, current: null });
  });
});
