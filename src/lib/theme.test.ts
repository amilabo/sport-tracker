import { describe, expect, it } from "vitest";
import { accentFits, ACCENTS, DEFAULT_ACCENT, normalizeTheme, themeInfo, themeInitScript, THEMES } from "./theme";

describe("normalizeTheme", () => {
  it("keeps a known accent", () => {
    expect(normalizeTheme({ mode: "dark", theme: "card", accent: "aqua" })).toEqual({ mode: "dark", theme: "card", accent: "aqua" });
  });

  it("falls back to defaults for records made before accents and for unknown ids", () => {
    expect(normalizeTheme({ mode: "light", theme: "card" }).accent).toBe(DEFAULT_ACCENT);
    expect(normalizeTheme({ accent: "neon", theme: "gone", mode: "sepia" as never })).toEqual({ mode: "system", theme: "card", accent: "signal" });
  });
});

describe("themes", () => {
  it("each theme offers its own default accent", () => {
    for (const t of THEMES) expect(accentFits(t.id, t.defaultAccent), t.id).toBe(true);
  });

  it("an accent a theme does not offer falls back to the theme's own; a missing accent too", () => {
    expect(accentFits("air", "sun")).toBe(false);
    expect(normalizeTheme({ mode: "light", theme: "air", accent: "sun" }).accent).toBe(themeInfo("air").defaultAccent);
    expect(normalizeTheme({ mode: "light", theme: "peony" }).accent).toBe("raspberry");
    expect(normalizeTheme({ mode: "light", theme: "peony", accent: "aqua" }).accent).toBe("aqua");
  });
});

describe("accents", () => {
  it("are unique and start with the default", () => {
    expect(ACCENTS[0].id).toBe(DEFAULT_ACCENT);
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
  });

  it("are applied by the <head> script before first paint", () => {
    expect(themeInitScript).toContain('setAttribute("data-accent"');
  });
});
