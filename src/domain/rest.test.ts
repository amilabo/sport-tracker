import { describe, expect, it } from "vitest";
import { cleanRest, formatRest, planFormat, REST_MAX, restSettings, restSnapshot, setRestFor, stepRest } from "./rest";

describe("rest settings", () => {
  it("a plan without rest fields is «Силовая» with 1:00 / 2:00 ready", () => {
    expect(restSettings({})).toEqual({ format: "strength", rest_set_sec: 60, rest_exercise_sec: 120 });
    expect(restSnapshot({})).toBeNull();
  });

  it("«С отдыхом» leaves a snapshot for the workout", () => {
    const plan = { format: "rest" as const, rest_set_sec: 90, rest_exercise_sec: 180 };
    expect(restSnapshot(plan)).toEqual({ format: "rest", rest_set_sec: 90, rest_exercise_sec: 180 });
  });

  it("broken values from an imported file fall back to defaults", () => {
    const broken = { format: "yoga", rest_set_sec: -5, rest_exercise_sec: "2:00" } as never;
    expect(planFormat(broken)).toBe("strength");
    expect(restSettings(broken)).toEqual({ format: "strength", rest_set_sec: 60, rest_exercise_sec: 120 });
    expect(cleanRest(Number.NaN)).toBeNull();
    expect(cleanRest(10_000)).toBe(REST_MAX);
    expect(cleanRest(44.6)).toBe(45);
  });

  it("an exercise's own value wins over the plan's", () => {
    expect(setRestFor({ rest_set_sec: 60 }, 120)).toBe(120);
    expect(setRestFor({ rest_set_sec: 60 }, null)).toBe(60);
    expect(setRestFor({ rest_set_sec: 60 }, 0)).toBe(0);
  });
});

describe("stepRest", () => {
  it("moves by 15 s within 0…30 min", () => {
    expect(stepRest(60, 1)).toBe(75);
    expect(stepRest(60, -1)).toBe(45);
    expect(stepRest(0, -1)).toBe(0);
    expect(stepRest(REST_MAX, 1)).toBe(REST_MAX);
  });

  it("snaps an off-grid value to the grid", () => {
    expect(stepRest(70, 1)).toBe(75);
    expect(stepRest(70, -1)).toBe(60);
  });

  it("formats as m:ss", () => {
    expect(formatRest(0)).toBe("0:00");
    expect(formatRest(90)).toBe("1:30");
  });
});
