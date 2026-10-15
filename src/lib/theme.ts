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
    description: "Бумага, чернила и сигнальный оранжевый",
  },
];

export const DEFAULT_THEME = "card";
export const DEFAULT_MODE: ModePref = "system";
export const THEME_STORAGE_KEY = "st-theme";

export interface StoredTheme {
  mode: ModePref;
  theme: string;
}

// Runs in <head> before first paint, so the page never flashes the wrong theme.
export const themeInitScript = `(function(){try{
var d=document.documentElement,s={};
try{s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"{}")}catch(e){}
var m=s.mode||${JSON.stringify(DEFAULT_MODE)},t=s.theme||${JSON.stringify(DEFAULT_THEME)};
var dark=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
d.setAttribute("data-theme",t);d.setAttribute("data-mode",dark?"dark":"light");
}catch(e){}})();`;

export function readStoredTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredTheme>) : {};
    return {
      mode: parsed.mode ?? DEFAULT_MODE,
      theme: THEMES.some((t) => t.id === parsed.theme) ? parsed.theme! : DEFAULT_THEME,
    };
  } catch {
    return { mode: DEFAULT_MODE, theme: DEFAULT_THEME };
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
export function applyTheme(theme: string, mode: Mode) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
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
