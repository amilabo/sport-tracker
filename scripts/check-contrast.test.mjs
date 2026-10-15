import { describe, expect, it } from "vitest";
import { contrast, parseThemes } from "./check-contrast.mjs";

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});

describe("parseThemes", () => {
  it("reads token blocks per theme and mode", () => {
    const css = `/* c */ [data-theme="x"][data-mode="dark"] { --bg: #111; --ink: #EEEEEE; }`;
    expect(parseThemes(css)).toEqual([{ theme: "x", mode: "dark", tokens: { bg: "#111", ink: "#EEEEEE" } }]);
  });
});
