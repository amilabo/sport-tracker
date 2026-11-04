// The APK (Capacitor). Loaded only in the android build, through the dynamic import in ./index.ts.
import { App } from "@capacitor/app";
import { registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { tokenHex } from "@/lib/css-color";
import { runBackGuard } from "./back";
import type { PlannedReminder } from "@/domain/reminders";
import type { RestSignal } from "@/domain/rest-signals";
import type { BackupFolder, HomeData, NotifyPermission, Platform } from "./types";

/** Our own plugin: android/app/src/main/java/app/napodhode/ScreenPlugin.java. */
const Screen = registerPlugin<{
  keepOn(options: { on: boolean }): Promise<void>;
  setBackground(options: { color: string }): Promise<void>;
  insets(): Promise<{ top: number; padded: boolean }>;
}>("Screen");

/** The status bar's height from Android itself into --native-top (globals.css takes the largest of three, 1.1.2). */
function measureTop() {
  Screen.insets()
    .then(({ top, padded }) => {
      document.documentElement.style.setProperty("--native-top", `${padded ? 0 : top}px`);
    })
    .catch(() => {});
}


/** Our own plugin: android/app/src/main/java/app/napodhode/BackupFolderPlugin.java. */
const Folder = registerPlugin<{
  folder(): Promise<{ folder?: BackupFolder }>;
  chooseFolder(): Promise<{ folder?: BackupFolder }>;
  write(options: { name: string; data: string }): Promise<void>;
  list(): Promise<{ files: { name: string; modified: number }[] }>;
  remove(options: { names: string[] }): Promise<void>;
}>("BackupFolder");

/** Our own plugin: android/app/src/main/java/app/napodhode/RestAlarmPlugin.java. */
const Alarm = registerPlugin<{
  permission(): Promise<{ state: NotifyPermission }>;
  requestPermission(): Promise<{ state: NotifyPermission }>;
  openSettings(): Promise<void>;
  schedule(options: { signals: RestSignal[]; sound: boolean }): Promise<void>;
  cancel(): Promise<void>;
  beep(options: { tick: boolean }): Promise<void>;
}>("RestAlarm");

/** Our own plugins: RemindersPlugin.java (A6), HomePlugin.java (A7–A8). */
const Reminders = registerPlugin<{ set(options: { items: PlannedReminder[] }): Promise<void> }>("Reminders");
const Home = registerPlugin<{ update(options: HomeData): Promise<void> }>("Home");

/** «app.napodhode://open/workout/?plan=…» → «/workout/?plan=…»; null — not ours. */
function pathOf(url: string): string | null {
  const m = /^app\.napodhode:\/\/open(\/[^#]*)?/.exec(url);
  return m ? (m[1] ?? "/") : null;
}
let launchHandled = false;

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
    // Again on resize: Capacitor may switch between padding the WebView and drawing it under the bar after loading.
    measureTop();
    window.addEventListener("resize", measureTop);
    // The first screen is drawn: take the launch screen away (it also goes by itself after 2.5 s).
    requestAnimationFrame(() => SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}));
    return () => {
      listener.then((l) => l.remove()).catch(() => {});
      window.removeEventListener("resize", measureTop);
    };
  },
  screenInsets: () => Screen.insets(),
  setSystemBars(dark) {
    // "Dark" style = light icons for a dark page.
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    // The window behind the bars takes the page color (seen where an old WebView is not drawn under them).
    const bg = tokenHex("--bg");
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
  notifications: {
    supported: true,
    permission: async () => (await Alarm.permission()).state,
    request: async () => (await Alarm.requestPermission()).state,
    openSettings: () => Alarm.openSettings(),
  },
  reminders: {
    supported: true,
    set: (items) => Reminders.set({ items }),
  },
  home: {
    supported: true,
    update: (data) => Home.update(data),
  },
  onOpen(cb) {
    // Started from a notification, a widget or a shortcut: the address it was started with — once per run.
    if (!launchHandled) {
      launchHandled = true;
      App.getLaunchUrl()
        .then((r) => {
          const path = r?.url ? pathOf(r.url) : null;
          if (path) cb(path);
        })
        .catch(() => {});
    }
    // Already running: Android hands the address over.
    const listener = App.addListener("appUrlOpen", ({ url }) => {
      const path = pathOf(url);
      if (path) cb(path);
    });
    return () => {
      listener.then((l) => l.remove()).catch(() => {});
    };
  },
  restAlarm: {
    schedule: (signals, sound) => (signals.length ? Alarm.schedule({ signals, sound }) : Alarm.cancel()),
    cancel: () => Alarm.cancel(),
    beep(tick) {
      Alarm.beep({ tick }).catch(() => {});
      return true;
    },
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
