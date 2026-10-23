export type ModePref = "light" | "dark" | "system";
export type Mode = "light" | "dark";

import themeList from "@/styles/themes/themes.json";

export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
  /** Chosen together with the theme; the person can pick another accent on top. */
  defaultAccent: string;
  /** Accents that cannot reach the contrast on this theme (e.g. bright fills on light panels): not offered. */
  excludedAccents: string[];
}

// Adding a theme = a new token file in src/styles/themes/ (imported in app/globals.css) + an entry in
// themes.json. scripts/check-contrast.mjs reads the same list.
export const THEMES: ThemeInfo[] = themeList;

export interface AccentInfo {
  id: string;
  name: string;
}

// The signal color on top of the theme. Adding one = a light and a dark block in src/styles/accents.css + an entry here.
// Ordered around the color wheel, as on the «Оформление» screen.
export const ACCENTS: AccentInfo[] = [
  { id: "signal", name: "Сигнал" },
  { id: "sun", name: "Солнце" },
  { id: "acid", name: "Кислота" },
  { id: "court", name: "Корт" },
  { id: "lagoon", name: "Лагуна" },
  { id: "aqua", name: "Аква" },
  { id: "electric", name: "Электрик" },
  { id: "violet", name: "Ультрафиолет" },
  { id: "raspberry", name: "Малина" },
];

export const DEFAULT_THEME = "card";
export const DEFAULT_ACCENT = "signal";
export const DEFAULT_MODE: ModePref = "system";
export const THEME_STORAGE_KEY = "st-theme";

export interface StoredTheme {
  mode: ModePref;
  theme: string;
  accent: string;
}

// Runs in <head> before first paint, so the page never flashes the wrong theme or accent.
export const themeInitScript = `(function(){try{
var d=document.documentElement,s={};
try{s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"{}")}catch(e){}
var m=s.mode||${JSON.stringify(DEFAULT_MODE)},t=s.theme||${JSON.stringify(DEFAULT_THEME)},a=s.accent||${JSON.stringify(DEFAULT_ACCENT)};
var dark=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
d.setAttribute("data-theme",t);d.setAttribute("data-accent",a);d.setAttribute("data-mode",dark?"dark":"light");
}catch(e){}})();`;

export function themeInfo(id: string): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!;
}

export function accentFits(theme: string, accent: string): boolean {
  return ACCENTS.some((a) => a.id === accent) && !themeInfo(theme).excludedAccents.includes(accent);
}

/**
 * Unknown ids (a removed theme or accent, a damaged value) fall back to the defaults;
 * an accent the theme does not offer falls back to the theme's own accent.
 */
export function normalizeTheme(value: Partial<StoredTheme>): StoredTheme {
  const theme = THEMES.some((t) => t.id === value.theme) ? value.theme! : DEFAULT_THEME;
  const accent = value.accent && accentFits(theme, value.accent) ? value.accent : themeInfo(theme).defaultAccent;
  return {
    mode: value.mode === "light" || value.mode === "dark" || value.mode === "system" ? value.mode : DEFAULT_MODE,
    theme,
    accent,
  };
}

export function readStoredTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeTheme(raw ? (JSON.parse(raw) as Partial<StoredTheme>) : {});
  } catch {
    return normalizeTheme({});
  }
}

/** False on a new phone (or after the browser data was cleared): nothing was chosen here yet. */
export function hasStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function writeStoredTheme(value: StoredTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
}

/** Applies the theme to <html> and syncs the browser chrome color with --bg. */
export function applyTheme(theme: string, accent: string, mode: Mode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-mode", mode);

  const color = getComputedStyle(root).getPropertyValue("--bg").trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  if (color) meta.content = color;
}
