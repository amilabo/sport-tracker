export type ModePref = "light" | "dark" | "system";
export type Mode = "light" | "dark";

export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
}

// Adding a theme = a new token file in src/styles/themes/ + one entry here.
export const THEMES: ThemeInfo[] = [
  {
    id: "card",
    name: "Тренировочная карточка",
    description: "Бумага, чернила и цветной сигнал",
  },
];

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

/** Unknown ids (a removed theme or accent, a damaged value) fall back to the defaults. */
export function normalizeTheme(value: Partial<StoredTheme>): StoredTheme {
  return {
    mode: value.mode === "light" || value.mode === "dark" || value.mode === "system" ? value.mode : DEFAULT_MODE,
    theme: THEMES.some((t) => t.id === value.theme) ? value.theme! : DEFAULT_THEME,
    accent: ACCENTS.some((a) => a.id === value.accent) ? value.accent! : DEFAULT_ACCENT,
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
