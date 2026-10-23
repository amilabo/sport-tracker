import { describe, expect, it } from "vitest";
import { ACCENT_TOKENS, checkAccents, checkThemeList, checkTokens, contrast, parseAccents, parseOverrides, parseThemes } from "./check-contrast.mjs";

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

  it("does not take accent blocks for themes", () => {
    expect(parseThemes(`[data-accent="sun"][data-mode="light"] { --accent: #FFD23F; }`)).toEqual([]);
  });
});

describe("accents", () => {
  const full = ACCENT_TOKENS.map((t) => `--${t}: #000000;`).join(" ");

  it("reads accent blocks", () => {
    expect(parseAccents(`[data-accent="sun"][data-mode="dark"] { --accent: #FFD23F; }`)).toEqual([
      { accent: "sun", mode: "dark", tokens: { accent: "#FFD23F" } },
    ]);
  });

  it("requires both modes and only accent tokens", () => {
    const accents = parseAccents(`
      [data-accent="a"][data-mode="light"] { ${full} --bg: #FFFFFF; }
      [data-accent="b"][data-mode="light"] { ${full} }
      [data-accent="b"][data-mode="dark"] { --accent: #000000; }`);
    const errors = checkAccents(accents);
    expect(errors).toContain("accent a × light: --bg is not an accent token");
    expect(errors).toContain("accent a: no dark block");
    expect(errors).toContain("accent b × dark: missing --on-accent");
  });

  it("reads accent shades adjusted for one theme apart from themes and accents", () => {
    const css = `[data-theme="air"][data-accent="violet"][data-mode="light"] { --accent-text: #4A2FD0; }`;
    expect(parseThemes(css)).toEqual([]);
    expect(parseAccents(css)).toEqual([]);
    expect(parseOverrides(css)).toEqual([{ theme: "air", accent: "violet", mode: "light", tokens: { "accent-text": "#4A2FD0" } }]);
  });

  it("the theme list matches the theme files and offers each theme its default accent", () => {
    const list = [
      { id: "card", defaultAccent: "signal", excludedAccents: [] },
      { id: "air", defaultAccent: "sun", excludedAccents: ["sun"] },
      { id: "gone", defaultAccent: "neon", excludedAccents: [] },
    ];
    const errors = checkThemeList(list, ["card", "air", "extra"], ["signal", "sun"]);
    expect(errors).toEqual([
      "themes.json: air excludes its own default accent",
      "themes.json: no token file for theme gone",
      "themes.json: gone default accent neon does not exist",
      "themes.json: theme extra is missing",
    ]);
  });

  it("catches a pale accent line on paper", () => {
    const { errors } = checkTokens("t", { bg: "#F2EDE4", surface: "#FBF8F2", "surface-raised": "#FFFFFF", "accent-line": "#DCF500" });
    expect(errors.some((e) => e.includes("--accent-line on --bg"))).toBe(true);
  });
});
