import { describe, expect, it } from "vitest";
import { newEntity } from "./entity";
import { pickNextPlan } from "./next-plan";
import type { Plan } from "./types";

const plan = (name: string): Plan => newEntity({ name, source: "self" as const, archived_at: null });
const [a, b, c] = [plan("А"), plan("Б"), plan("В")];

describe("pickNextPlan", () => {
  it("returns null without plans", () => {
    expect(pickNextPlan([], new Map())).toBeNull();
  });

  it("takes the first plan when nothing has been done", () => {
    expect(pickNextPlan([a, b, c], new Map())).toBe(a);
  });

  it("rotates: a never-done plan goes before done ones", () => {
    const last = new Map([[a.id, "2026-10-07T09:00:00.000Z"]]);
    expect(pickNextPlan([a, b, c], last)).toBe(b);
  });

  it("when all were done, takes the one done longest ago", () => {
    const last = new Map([
      [a.id, "2026-10-07T09:00:00.000Z"],
      [b.id, "2026-10-05T09:00:00.000Z"],
      [c.id, "2026-10-09T09:00:00.000Z"],
    ]);
    expect(pickNextPlan([a, b, c], last)).toBe(b);
  });
});
