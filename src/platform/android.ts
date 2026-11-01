// The APK (Capacitor). Loaded only in the android build, through the dynamic import in ./index.ts.
import { App } from "@capacitor/app";
import { registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { runBackGuard } from "./back";
import type { BackupFolder, Platform } from "./types";

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

/** Our own plugin: android/app/src/main/java/app/napodhode/BackupFolderPlugin.java. */
const Folder = registerPlugin<{
  folder(): Promise<{ folder?: BackupFolder }>;
  chooseFolder(): Promise<{ folder?: BackupFolder }>;
  write(options: { name: string; data: string }): Promise<void>;
  list(): Promise<{ files: { name: string; modified: number }[] }>;
  remove(options: { names: string[] }): Promise<void>;
}>("BackupFolder");

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
  async shareFile(file) {
    // A real file in the app's cache (no permission needed, Android may clear it), then «Поделиться».
    // Copies of other days are removed first: the cache keeps only the one being sent.
    const { files } = await Filesystem.readdir({ path: "", directory: Directory.Cache }).catch(() => ({ files: [] }));
    await Promise.all(
      files
        .filter((f) => f.name.startsWith("sport-tracker-backup-") && f.name !== file.name)
        .map((f) => Filesystem.deleteFile({ path: f.name, directory: Directory.Cache }).catch(() => {})),
    );
    const { uri } = await Filesystem.writeFile({
      path: file.name,
      data: await file.text(),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: file.name, files: [uri] });
      return "shared";
    } catch (err) {
      // Closing the share sheet rejects with «Share canceled».
      if (/cancel/i.test(err instanceof Error ? err.message : String(err))) return "cancelled";
      throw err;
    }
  },
  autoBackup: {
    supported: true,
    folder: async () => (await Folder.folder()).folder ?? null,
    chooseFolder: async () => (await Folder.chooseFolder()).folder ?? null,
    write: (name, data) => Folder.write({ name, data }),
    list: async () => (await Folder.list()).files,
    remove: (names) => Folder.remove({ names }),
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
