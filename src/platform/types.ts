// What the device can do beyond the browser. The site and the APK differ only behind this interface
// (see ../apk/docs/android-capacitor-architecture.md §3.1); screens and lib/ never check the target themselves.

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
}
