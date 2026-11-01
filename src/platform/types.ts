// What the device can do beyond the browser. The site and the APK differ only behind this interface
// (see ../apk/docs/android-capacitor-architecture.md §3.1); screens and lib/ never check the target themselves.

export interface Platform {
  kind: "web" | "android";
  /** Once at startup: the back button, the launch screen. Returns the cleanup. */
  start(): () => void;
  /** Light or dark icons on the status and navigation bars. The bars are transparent: the page shows through. */
  setSystemBars(dark: boolean): void;
  /** Keeps the screen on while true; resolves false if it cannot (the screen goes off as usual). */
  keepScreenOn(on: boolean): Promise<boolean>;
}
