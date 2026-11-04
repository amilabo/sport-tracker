// What the device can do beyond the browser. The site and the APK differ only behind this interface
// (see ../apk/docs/android-capacitor-architecture.md §3.1); screens and lib/ never check the target themselves.
import type { PlannedReminder } from "@/domain/reminders";
import type { RestSignal } from "@/domain/rest-signals";

/** Notifications: on; Android may still ask; only the phone's settings can turn them on. */
export type NotifyPermission = "granted" | "prompt" | "denied";

/** What the home screen widgets (A7) and the icon shortcuts (A8) show; written by lib/home-sync. */
export interface HomeData {
  widgets: {
    /** Monday of the week the days are about («2026-11-02»): another week on the phone — «0 из N». */
    week: string;
    /** Weekdays with a workout, Monday 0. */
    doneDays: number[];
    count: number;
    goal: number | null;
    /** The day of the last workout, local («2026-10-29»); null — none yet. */
    last: string | null;
    next: { id: string; name: string } | null;
    /** The theme's colors as #rrggbb: surface, ink, muted, line, panel, panelInk, panelMuted, accent, onAccent. */
    colors: Record<string, string>;
  };
  /** The workout shortcut: «Ноги / грудь / руки» → the plan before «Начать»; «Продолжить: …»; «Тренировки». */
  shortcut: { label: string; path: string };
}

/** The folder for automatic copies: its name for people, and whether the app can still write there. */
export interface BackupFolder {
  name: string;
  ok: boolean;
}

export interface Platform {
  kind: "web" | "android";
  /** Once at startup: the back button, the launch screen. Returns the cleanup. */
  start(): () => void;
  /** Light or dark icons on the status and navigation bars. The bars are transparent: the page shows through. */
  setSystemBars(dark: boolean): void;
  /** APK: the status bar's height in px as Android has it; padded — the WebView is already below it. Site: null. */
  screenInsets(): Promise<{ top: number; padded: boolean } | null>;
  /** Keeps the screen on while true; resolves false if it cannot (the screen goes off as usual). */
  keepScreenOn(on: boolean): Promise<boolean>;
  /** APK: the file as it is (a real .json) through the system share sheet. The site uses Web Share in lib/backup-share.ts. */
  shareFile(file: File): Promise<"shared" | "cancelled">;
  /** Automatic copy into a folder on the phone (APK only, stage A3). */
  autoBackup: {
    supported: boolean;
    /** The chosen folder, or null if none was chosen yet. */
    folder(): Promise<BackupFolder | null>;
    /** Android's folder picker; null if the person backed out. */
    chooseFolder(): Promise<BackupFolder | null>;
    write(name: string, data: string): Promise<void>;
    /** Files in the folder; `modified` in ms. */
    list(): Promise<{ name: string; modified: number }[]>;
    remove(names: string[]): Promise<void>;
  };
  /** Notification permission (APK, A5–A6): one for the rest signal and the reminders. */
  notifications: {
    supported: boolean;
    permission(): Promise<NotifyPermission>;
    /** Android's one-time dialog; resolves with the answer. */
    request(): Promise<NotifyPermission>;
    openSettings(): Promise<void>;
  };
  /** The reminders of «Ритм» (APK, A6): the whole list ahead, replacing the one before. */
  reminders: {
    supported: boolean;
    set(items: PlannedReminder[]): Promise<void>;
  };
  /** Home screen widgets and icon shortcuts (APK, A7–A8). */
  home: {
    supported: boolean;
    update(data: HomeData): Promise<void>;
  };
  /** A screen opened from outside (a notification, a widget, a shortcut): its path inside the app. Returns the cleanup. */
  onOpen(cb: (path: string) => void): () => void;
  /** The rest signal while the app is away (APK, A5). */
  restAlarm: {
    /** Replaces the timeline (domain/rest-signals); an empty one cancels. */
    schedule(signals: RestSignal[], sound: boolean): Promise<void>;
    cancel(): Promise<void>;
    /** The beeps on screen by the same rule as away (headphones over the music); false — not here, the page plays them. */
    beep(tick: boolean): boolean;
  };
}
