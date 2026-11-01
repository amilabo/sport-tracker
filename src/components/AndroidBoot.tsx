"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshBackupFolder, runAutoBackup } from "@/lib/auto-backup";
import { startHomeSync } from "@/lib/home-sync";
import { getPlatform } from "@/platform";

/**
 * APK only (instead of PwaBoot): the back button, the launch screen, the automatic copy on opening;
 * the reminders, widgets and icon shortcuts kept in step with the data (A6–A8); screens opened from them.
 */
export function AndroidBoot() {
  const router = useRouter();

  useEffect(() => {
    let stop: (() => void) | undefined;
    let stopOpen: (() => void) | undefined;
    let alive = true;
    getPlatform().then((p) => {
      if (!alive) return;
      stop = p.start();
      stopOpen = p.onOpen((path) => router.push(path));
    });
    const stopSync = startHomeSync();
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
      stopOpen?.();
      stopSync();
      document.removeEventListener("visibilitychange", opened);
    };
  }, [router]);
  return null;
}
