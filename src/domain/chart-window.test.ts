import { describe, expect, it } from "vitest";
import { moveEdge, presetWindow, stepEdge, windowOf } from "./chart-window";

const DATES = ["2025-09-15", "2025-10-13", "2026-01-12", "2026-07-13", "2026-08-03", "2026-10-05", "2026-10-19"];

describe("presetWindow", () => {
  it("«3 мес» and «Год» count calendar months back from the latest point; «Всё» is the whole history", () => {
    expect(presetWindow(DATES, 3)).toEqual({ a: 4, b: 6 });
    expect(presetWindow(DATES, 12)).toEqual({ a: 2, b: 6 });
    expect(presetWindow(DATES, null)).toEqual({ a: 0, b: 6 });
  });

  it("nothing inside the months — only the latest point; no points — an empty window at 0", () => {
    expect(presetWindow(["2025-01-10", "2026-10-19"], 3)).toEqual({ a: 1, b: 1 });
    expect(presetWindow([], 3)).toEqual({ a: 0, b: 0 });
  });
});

describe("stepEdge", () => {
  it("moves an edge by one point, keeping at least two points and staying inside the history", () => {
    expect(stepEdge({ a: 4, b: 6 }, "a", -1, 7)).toEqual({ a: 3, b: 6 });
    expect(stepEdge({ a: 4, b: 6 }, "a", 1, 7)).toEqual({ a: 5, b: 6 });
    expect(stepEdge({ a: 5, b: 6 }, "a", 1, 7)).toBeNull();
    expect(stepEdge({ a: 0, b: 6 }, "a", -1, 7)).toBeNull();
    expect(stepEdge({ a: 4, b: 6 }, "b", 1, 7)).toBeNull();
    expect(stepEdge({ a: 4, b: 6 }, "b", -1, 7)).toEqual({ a: 4, b: 5 });
    expect(stepEdge({ a: 4, b: 5 }, "b", -1, 7)).toBeNull();
  });

  it("a one-point window can widen to the left", () => {
    expect(stepEdge({ a: 1, b: 1 }, "a", -1, 2)).toEqual({ a: 0, b: 1 });
  });
});

describe("moveEdge", () => {
  it("drags an edge to a point and stops one point before the other edge", () => {
    expect(moveEdge({ a: 4, b: 6 }, "a", 1, 7)).toEqual({ a: 1, b: 6 });
    expect(moveEdge({ a: 4, b: 6 }, "a", 6, 7)).toEqual({ a: 5, b: 6 });
    expect(moveEdge({ a: 1, b: 6 }, "b", 0, 7)).toEqual({ a: 1, b: 2 });
    expect(moveEdge({ a: 1, b: 3 }, "b", 9, 7)).toEqual({ a: 1, b: 6 });
    expect(moveEdge({ a: 0, b: 0 }, "b", 0, 1)).toEqual({ a: 0, b: 0 });
  });
});

describe("windowOf", () => {
  it("dates of a window → indices; a date that is gone gives the whole history", () => {
    expect(windowOf(DATES, "2026-07-13", "2026-10-05")).toEqual({ a: 3, b: 5 });
    expect(windowOf(DATES, "2026-07-14", "2026-10-05")).toEqual({ a: 0, b: 6 });
    expect(windowOf(DATES, null, null)).toEqual({ a: 0, b: 6 });
  });
});
