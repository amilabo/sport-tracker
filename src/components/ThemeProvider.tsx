"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { settingsRepo } from "@/db/repos/settings";
import {
  applyTheme,
  DEFAULT_MODE,
  DEFAULT_THEME,
  readStoredTheme,
  writeStoredTheme,
  type Mode,
  type ModePref,
  type StoredTheme,
} from "@/lib/theme";

// The theme choice lives outside React: localStorage is the source the inline <head> script reads.
const SERVER_THEME: StoredTheme = { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
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
    settingsRepo.update({ theme_mode: next.mode, color_theme: next.theme }).catch(console.error);
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
  modePref: ModePref;
  mode: Mode;
  setTheme: (theme: string) => void;
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

  useEffect(() => {
    if (hydrated) applyTheme(stored.theme, mode);
  }, [hydrated, stored.theme, mode]);

  const setTheme = useCallback((theme: string) => themeStore.set({ ...themeStore.getSnapshot(), theme }), []);
  const setModePref = useCallback((m: ModePref) => themeStore.set({ ...themeStore.getSnapshot(), mode: m }), []);

  return (
    <ThemeContext.Provider value={{ theme: stored.theme, modePref: stored.mode, mode, setTheme, setModePref }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
