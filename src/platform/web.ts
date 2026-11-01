import type { Platform } from "./types";

/** The site: everything stays as the browser does it (service worker, Wake Lock and install hint live in their components). */
export const web: Platform = {
  kind: "web",
  start: () => () => {},
  setSystemBars() {},
  keepScreenOn: async () => false,
  shareFile: async () => {
    throw new Error("shareFile is APK-only: the site shares through navigator.share");
  },
  // A browser cannot write into a folder by itself: the site keeps «Давно не сохраняли копию» instead.
  autoBackup: {
    supported: false,
    folder: async () => null,
    chooseFolder: async () => null,
    write: async () => {
      throw new Error("autoBackup is APK-only");
    },
    list: async () => [],
    remove: async () => {},
  },
  // The site gives the rest signal only while it is on screen (Wake Lock keeps it there).
  notifications: {
    supported: false,
    permission: async () => "denied",
    request: async () => "denied",
    openSettings: async () => {},
  },
  reminders: { supported: false, set: async () => {} },
  home: { supported: false, update: async () => {} },
  onOpen: () => () => {},
  restAlarm: {
    schedule: async () => {},
    cancel: async () => {},
    beep: () => false,
  },
};
