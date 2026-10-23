"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { settingsRepo } from "@/db/repos/settings";
import {
  applyTheme,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  DEFAULT_THEME,
  hasStoredTheme,
  normalizeTheme,
  readStoredTheme,
  themeInfo,
  writeStoredTheme,
  type Mode,
  type ModePref,
  type StoredTheme,
} from "@/lib/theme";

// The theme choice lives outside React: localStorage is the source the inline <head> script reads.
const SERVER_THEME: StoredTheme = { theme: DEFAULT_THEME, accent: DEFAULT_ACCENT, mode: DEFAULT_MODE };
let currentTheme: StoredTheme | null = null;
const themeListeners = new Set<() => void>();

const themeStore = {
  subscribe(listener: () => void) {
    themeListeners.add(listener);
    return () => themeListeners.delete(listener);
  },
  getSnapshot(): StoredTheme {
    if (!currentTheme) currentTheme = readStoredTheme();
    return currentTheme;
  },
  getServerSnapshot: () => SERVER_THEME,
  set(next: StoredTheme) {
    currentTheme = next;
    writeStoredTheme(next);
    themeListeners.forEach((l) => l());
    // Also keep the choice in IndexedDB settings, so it travels with the backup file.
    settingsRepo.update({ theme_mode: next.mode, color_theme: next.theme, accent: next.accent }).catch(console.error);
  },
};

const noopSubscribe = () => () => {};

const DARK_QUERY = "(prefers-color-scheme: dark)";
const systemDarkStore = {
  subscribe(listener: () => void) {
    const mq = window.matchMedia(DARK_QUERY);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  },
  getSnapshot: () => window.matchMedia(DARK_QUERY).matches,
  getServerSnapshot: () => false,
};

interface ThemeContextValue {
  theme: string;
  accent: string;
  modePref: ModePref;
  mode: Mode;
  setTheme: (theme: string) => void;
  setAccent: (accent: string) => void;
  setModePref: (mode: ModePref) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot);
  const systemDark = useSyncExternalStore(
    systemDarkStore.subscribe,
    systemDarkStore.getSnapshot,
    systemDarkStore.getServerSnapshot,
  );
  // During hydration the stores return server defaults; applying them would flash the light theme
  // over the one the inline script already set. Apply only once real client values are known.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const mode: Mode = stored.mode === "system" ? (systemDark ? "dark" : "light") : stored.mode;

  // Nothing chosen in this browser yet (a new phone restored from a backup): take the choice from the settings.
  useEffect(() => {
    if (hasStoredTheme()) return;
    settingsRepo
      .get()
      .then((s) => themeStore.set(normalizeTheme({ mode: s.theme_mode, theme: s.color_theme, accent: s.accent })))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (hydrated) applyTheme(stored.theme, stored.accent, mode);
  }, [hydrated, stored.theme, stored.accent, mode]);

  // A theme comes with its own accent (as on the «Оформление» previews); another one can be picked after.
  const setTheme = useCallback(
    (theme: string) => themeStore.set({ ...themeStore.getSnapshot(), theme, accent: themeInfo(theme).defaultAccent }),
    [],
  );
  const setAccent = useCallback((accent: string) => themeStore.set({ ...themeStore.getSnapshot(), accent }), []);
  const setModePref = useCallback((m: ModePref) => themeStore.set({ ...themeStore.getSnapshot(), mode: m }), []);

  return (
    <ThemeContext.Provider value={{ theme: stored.theme, accent: stored.accent, modePref: stored.mode, mode, setTheme, setAccent, setModePref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
