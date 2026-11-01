"use client";

import { useEffect } from "react";
import { refreshBackupFolder, runAutoBackup } from "@/lib/auto-backup";
import { getPlatform } from "@/platform";

/** APK only (instead of PwaBoot): the back button, the launch screen, the automatic copy on opening. */
export function AndroidBoot() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    getPlatform().then((p) => {
      if (alive) stop = p.start();
    });
    // On opening and on every return to the app: the folder may be gone; a copy if the data changed (≤ 1 per hour).
    const opened = () => {
      if (document.visibilityState !== "visible") return;
      refreshBackupFolder()
        .then(() => runAutoBackup("open"))
        .catch(console.error);
    };
    opened();
    document.addEventListener("visibilitychange", opened);
    return () => {
      alive = false;
      stop?.();
      document.removeEventListener("visibilitychange", opened);
    };
  }, []);
  return null;
}
