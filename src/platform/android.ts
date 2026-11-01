// The APK (Capacitor). Loaded only in the android build, through the dynamic import in ./index.ts.
import { App } from "@capacitor/app";
import { registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { runBackGuard } from "./back";
import type { Platform } from "./types";

/** Our own plugin: android/app/src/main/java/app/napodhode/ScreenPlugin.java. */
const Screen = registerPlugin<{
  keepOn(options: { on: boolean }): Promise<void>;
  setBackground(options: { color: string }): Promise<void>;
}>("Screen");

/** "#000", "rgb(…)" and other CSS forms → "#rrggbb" (what Android's Color.parseColor reads); null if not a color. */
function toHex(css: string): string | null {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !css.trim()) return null;
  ctx.fillStyle = css.trim();
  return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : null;
}

type Closable = HTMLDialogElement & { requestClose?: () => void };

/** Back button: a sheet closes → a screen with unsaved changes asks → previous screen → home leaves to the background. */
function onBack({ canGoBack }: { canGoBack: boolean }) {
  const dialogs = document.querySelectorAll<Closable>("dialog[open]");
  const top = dialogs[dialogs.length - 1];
  if (top) {
    // The same path as Esc: the sheet's own onClose runs.
    if (top.requestClose) top.requestClose();
    else top.close();
    return;
  }
  if (runBackGuard()) return;
  // Minimize, not exit: a workout in progress stays exactly where it was.
  if (canGoBack && window.location.pathname !== "/") window.history.back();
  else App.minimizeApp().catch(() => {});
}

export const android: Platform = {
  kind: "android",
  start() {
    const listener = App.addListener("backButton", onBack);
    // The first screen is drawn: take the launch screen away (it also goes by itself after 2.5 s).
    requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}));
    return () => {
      listener.then((l) => l.remove()).catch(() => {});
    };
  },
  setSystemBars(dark) {
    // "Dark" style = light icons for a dark page.
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    // The window behind the bars takes the page color (seen where an old WebView is not drawn under them).
    const bg = toHex(getComputedStyle(document.documentElement).getPropertyValue("--bg"));
    if (bg) Screen.setBackground({ color: bg }).catch(() => {});
  },
  async keepScreenOn(on) {
    try {
      await Screen.keepOn({ on });
      return true;
    } catch {
      return false;
    }
  },
};
