import { describe, expect, it } from "vitest";
import { parseQuickInput } from "./quick-input";
import { formatSet, formatSetsSummary, toQuickInput } from "./sets";
import type { LogType, SetValues } from "./types";

const ok = (text: string, logType: LogType): SetValues[] => {
  const r = parseQuickInput(text, logType);
  if (!r.ok) throw new Error(`"${text}" (${logType}): ${r.error}`);
  return r.sets;
};
const bad = (text: string, logType: LogType) => expect(parseQuickInput(text, logType).ok).toBe(false);
const wr = (weight: number | null, reps: number): SetValues => ({ weight, reps, duration_sec: null, speed_kmh: null });
const t = (duration_sec: number, speed_kmh: number | null = null): SetValues => ({ weight: null, reps: null, duration_sec, speed_kmh });

describe("parseQuickInput: weight × reps", () => {
  it("N × reps × weight in all spellings", () => {
    for (const s of ["4 × 12 × 20", "4x12x20", "4х12х20", "4*12*20", " 4 × 12 × 20 кг ", "4 X 12 X 20kg"]) {
      expect(ok(s, "weight_reps")).toEqual([wr(20, 12), wr(20, 12), wr(20, 12), wr(20, 12)]);
    }
  });

  it("decimal comma or dot in the weight", () => {
    expect(ok("3 × 10 × 42,5", "weight_reps")).toEqual([wr(42.5, 10), wr(42.5, 10), wr(42.5, 10)]);
    expect(ok("3 × 10 × 17.5", "weight_reps")[0].weight).toBe(17.5);
  });

  it("a «кг» mark puts the weight anywhere", () => {
    expect(ok("4 × 20 кг × 12", "weight_reps")).toEqual([wr(20, 12), wr(20, 12), wr(20, 12), wr(20, 12)]);
  });

  it("without weight: N × reps", () => {
    expect(ok("4 × 20", "weight_reps")).toEqual([wr(null, 20), wr(null, 20), wr(null, 20), wr(null, 20)]);
    expect(ok("4 × 12 раз", "weight_reps")).toHaveLength(4);
  });

  it("list of weight × reps pairs, with or without spaces", () => {
    const expected = [wr(40, 12), wr(45, 10), wr(50, 8)];
    expect(ok("40×12, 45×10, 50×8", "weight_reps")).toEqual(expected);
    expect(ok("40×12,45×10,50×8", "weight_reps")).toEqual(expected);
    expect(ok("40×12; 45×10; 50×8", "weight_reps")).toEqual(expected);
    expect(ok("20×12, 20×12", "weight_reps")).toEqual([wr(20, 12), wr(20, 12)]);
    expect(ok("42,5×10, 45×8", "weight_reps")).toEqual([wr(42.5, 10), wr(45, 8)]);
  });

  it("a single pair is weight × reps when the first number cannot be a set count", () => {
    expect(ok("40 × 12", "weight_reps")).toEqual([wr(40, 12)]);
    expect(ok("40 кг × 12", "weight_reps")).toEqual([wr(40, 12)]);
  });

  it("groups can mix: 2 × 12 × 40, 2 × 10 × 45", () => {
    expect(ok("2 × 12 × 40, 2 × 10 × 45", "weight_reps")).toEqual([wr(40, 12), wr(40, 12), wr(45, 10), wr(45, 10)]);
  });

  it("empty text means no sets", () => {
    expect(ok("   ", "weight_reps")).toEqual([]);
  });

  it("rejects nonsense, negative weight, fractional reps, too many sets", () => {
    bad("жим", "weight_reps");
    bad("4 × 12 × -20", "weight_reps");
    bad("4 × 12,5 × 20", "weight_reps");
    bad("21 × 12 × 20", "weight_reps");
    bad("4 × 12 × 20 × 3", "weight_reps");
    bad("4 × 12 × 20 мин", "weight_reps");
    const r = parseQuickInput("абв", "weight_reps");
    expect(r.ok === false && r.error).toBe("Не понял запись — пример: 4 × 12 × 20");
  });
});

describe("parseQuickInput: other log types", () => {
  it("reps: N × reps, single and list", () => {
    expect(ok("3 × 15", "reps")).toEqual([wr(null, 15), wr(null, 15), wr(null, 15)]);
    expect(ok("12", "reps")).toEqual([wr(null, 12)]);
    expect(ok("12, 10, 8", "reps").map((s) => s.reps)).toEqual([12, 10, 8]);
    bad("3 × 15 × 20", "reps");
  });

  it("bodyweight plus: extra weight or assistance", () => {
    expect(ok("4 × 10 × −20", "bodyweight_plus")[0]).toEqual(wr(-20, 10));
    expect(ok("4 × 8 × +10", "bodyweight_plus")[0]).toEqual(wr(10, 8));
    expect(ok("4 × 8 × 10 кг", "bodyweight_plus")).toHaveLength(4);
    expect(ok("-35×10, -30×10", "bodyweight_plus")).toEqual([wr(-35, 10), wr(-30, 10)]);
    expect(ok("5 × 12", "bodyweight_plus")).toEqual(Array(5).fill(wr(null, 12)));
  });

  it("time: m:ss, seconds and minutes (club app writes «0,5 мин»)", () => {
    expect(ok("3 × 0:30", "time")).toEqual([t(30), t(30), t(30)]);
    expect(ok("3 × 30", "time")).toEqual([t(30), t(30), t(30)]);
    expect(ok("3 × 0,5 мин", "time")).toEqual([t(30), t(30), t(30)]);
    expect(ok("1:30", "time")).toEqual([t(90)]);
    expect(ok("45 сек", "time")).toEqual([t(45)]);
    expect(ok("0:30, 0:45", "time")).toEqual([t(30), t(45)]);
    bad("3 × 0:75", "time");
    bad("3 × 30 кг", "time");
  });

  it("cardio: minutes × km/h in either order", () => {
    expect(ok("15 мин × 10 км/ч", "cardio")).toEqual([t(900, 10)]);
    expect(ok("15 × 10", "cardio")).toEqual([t(900, 10)]);
    expect(ok("10 км/ч × 15 мин", "cardio")).toEqual([t(900, 10)]);
    expect(ok("20 мин", "cardio")).toEqual([t(1200)]);
    expect(ok("15:30 × 9,5", "cardio")).toEqual([t(930, 9.5)]);
    expect(ok("2 × 10 × 8", "cardio")).toEqual([t(600, 8), t(600, 8)]);
    bad("10 км/ч", "cardio");
    bad("15 × 80", "cardio");
  });
});

describe("formatting", () => {
  it("summaries match the mockups", () => {
    expect(formatSetsSummary("weight_reps", ok("4 × 10 × 15", "weight_reps"))).toBe("4 × 10 × 15 кг");
    expect(formatSetsSummary("weight_reps", ok("40×12, 45×10, 50×8", "weight_reps"))).toBe("40×12 · 45×10 · 50×8 кг");
    expect(formatSetsSummary("weight_reps", ok("4 × 20", "weight_reps"))).toBe("4 × 20 раз");
    expect(formatSetsSummary("reps", ok("4 × 12", "reps"))).toBe("4 × 12 раз");
    expect(formatSetsSummary("reps", ok("12, 12, 11", "reps"))).toBe("12 · 12 · 11 раз");
    expect(formatSetsSummary("time", ok("3 × 0:30", "time"))).toBe("3 × 0:30");
    expect(formatSetsSummary("cardio", ok("15 × 10", "cardio"))).toBe("15 мин · 10 км/ч");
    expect(formatSetsSummary("bodyweight_plus", ok("4 × 12 × -20", "bodyweight_plus"))).toBe("4 × 12 × −20 кг");
    expect(formatSetsSummary("weight_reps", ok("3 × 10 × 42,5", "weight_reps"))).toBe("3 × 10 × 42,5 кг");
    expect(formatSetsSummary("reps", [])).toBe("нет подходов");
  });

  it("chips", () => {
    expect(formatSet("weight_reps", wr(42.5, 10))).toBe("42,5×10");
    expect(formatSet("bodyweight_plus", wr(-20, 10))).toBe("−20×10");
    expect(formatSet("bodyweight_plus", wr(10, 8))).toBe("+10×8");
    expect(formatSet("reps", wr(null, 12))).toBe("12 раз");
    expect(formatSet("time", t(30))).toBe("0:30");
  });

  it("toQuickInput round-trips through the parser", () => {
    const cases: [LogType, string][] = [
      ["weight_reps", "4 × 12 × 20"],
      ["weight_reps", "40×12, 45×10, 50×8"],
      ["weight_reps", "3 × 10 × 42,5"],
      ["weight_reps", "4 × 20"],
      ["weight_reps", "40×12, 12 раз"],
      ["reps", "3 × 15"],
      ["reps", "12, 10, 8"],
      ["bodyweight_plus", "4 × 10 × −20"],
      ["bodyweight_plus", "-35×10, -30×10"],
      ["time", "3 × 0:30"],
      ["time", "0:30, 0:45"],
      ["cardio", "15 мин × 10 км/ч"],
      ["cardio", "20 мин"],
      ["cardio", "2 × 10 × 8"],
    ];
    for (const [logType, text] of cases) {
      const sets = ok(text, logType);
      expect(ok(toQuickInput(logType, sets), logType)).toEqual(sets);
    }
    expect(toQuickInput("weight_reps", ok("4 × 12 × 20", "weight_reps"))).toBe("4 × 12 × 20");
    expect(toQuickInput("cardio", ok("15 × 10", "cardio"))).toBe("15 мин × 10 км/ч");
  });
});
