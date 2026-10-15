// PWA helpers: base path, install state and the Android install prompt.

/** "/sport-tracker" on GitHub Pages, "" locally (see next.config.ts). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Opened from the home screen icon, not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type Platform = "ios" | "android" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch points tell it apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Chrome's beforeinstallprompt event (not in the TS DOM types). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The event fires once, early, possibly before the hint is on screen: keep it in a tiny external store.
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    listeners.forEach((l) => l());
  });
}

export const installPrompt = {
  subscribe(listener: () => void) {
    listen();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => installEvent,
  /** Shows the system install dialog; true if the user installed the app. */
  async show(): Promise<boolean> {
    const e = installEvent;
    if (!e) return false;
    installEvent = null;
    listeners.forEach((l) => l());
    await e.prompt();
    return (await e.userChoice).outcome === "accepted";
  },
};

/** Starts listening as early as possible (called from the app shell). */
export function initInstallPrompt() {
  listen();
}
