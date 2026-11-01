"use client";

import { useMemo, useSyncExternalStore } from "react";
import { REMINDERS_DEFAULT, type ReminderSettings } from "@/domain/reminders";

// APK A6: «Дни тренировок» and the three reminders are kept on this phone only, not in a backup:
// the notification permission is the phone's own, and the site has no reminders.
const KEY = "st-reminders";
const EVENT = "st-reminders-change";

export function readReminders(): ReminderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return REMINDERS_DEFAULT;
    const v = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      ...REMINDERS_DEFAULT,
      ...v,
      weekly: { ...REMINDERS_DEFAULT.weekly, ...v.weekly },
      tomorrow: { ...REMINDERS_DEFAULT.tomorrow, ...v.tomorrow },
      goal: { ...REMINDERS_DEFAULT.goal, ...v.goal },
    };
  } catch {
    return REMINDERS_DEFAULT;
  }
}

export function writeReminders(value: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private mode: the change lasts until the app is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onRemindersChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function rawReminders(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The settings, live; null while rendered outside the browser (the static build). */
export function useReminderSettings(): [ReminderSettings | null, (value: ReminderSettings) => void] {
  const raw = useSyncExternalStore(onRemindersChange, rawReminders, () => null);
  const value = useMemo(() => (raw === null ? null : readReminders()), [raw]);
  return [value, writeReminders];
}
