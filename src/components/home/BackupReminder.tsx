"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { getDb } from "@/db/client";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { latestOf } from "@/domain/auto-backup";
import { isBackupDue } from "@/domain/backup-reminder";
import { toLocalDate } from "@/domain/time";
import { useAutoBackup } from "@/lib/auto-backup";
import { deliverBackup, usePreparedBackup } from "@/lib/backup-share";
import { IS_ANDROID } from "@/platform";

// «Не сейчас» hides the reminder until tomorrow (this phone only).
const SNOOZE_KEY = "st-backup-snooze";
const snoozeListeners = new Set<() => void>();
const snooze = {
  subscribe(l: () => void) {
    snoozeListeners.add(l);
    return () => {
      snoozeListeners.delete(l);
    };
  },
  get(): string | null {
    try {
      return localStorage.getItem(SNOOZE_KEY);
    } catch {
      return null;
    }
  },
  set(date: string) {
    try {
      localStorage.setItem(SNOOZE_KEY, date);
    } catch {
      // storage unavailable: hidden for this visit only
    }
    snoozeListeners.forEach((l) => l());
  },
};

/** «Давно не сохраняли копию» with «Сохранить» (PRD §3.11). */
export function BackupReminder() {
  // APK: the automatic copy (stage A3) counts as well — while it works, the reminder stays away.
  const autoLastAt = useAutoBackup().lastAt;
  const { data: due } = useLive(
    async () => {
      const [settings, workouts] = await Promise.all([settingsRepo.get(), (await getDb()).getAll("workouts")]);
      return isBackupDue(latestOf(settings.last_export_at, autoLastAt), settings.created_at, workouts);
    },
    [autoLastAt],
    ["settings", "workouts"],
  );
  const snoozedUntil = useSyncExternalStore(snooze.subscribe, snooze.get, () => null);
  const [hidden, setHidden] = useState(false);
  const show = !!due && !hidden && snoozedUntil !== toLocalDate();
  const file = usePreparedBackup(show);

  if (!show) return null;

  return (
    <section aria-label="Копия данных" className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-line-strong bg-surface p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">Давно не сохраняли копию</span>
        <span className="text-[13px] leading-snug text-ink-muted">
          Записи есть только в этом телефоне. {IS_ANDROID ? "Отправьте" : "Сохраните"} файл копии — например, себе в мессенджер.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setHidden(true);
            snooze.set(toLocalDate());
          }}
        >
          Не сейчас
        </Button>
        <Button variant="primary" disabled={!file} onClick={() => file && deliverBackup(file).catch(console.error)}>
          {/* APK: the file goes through «Поделиться», not into the phone — the button says so. */}
          {IS_ANDROID ? "Отправить" : "Сохранить"}
        </Button>
      </div>
    </section>
  );
}
