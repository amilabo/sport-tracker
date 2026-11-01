"use client";

import { useEffect, useRef, useState } from "react";
import { restSignals, type SignalItem } from "@/domain/rest-signals";
import type { RestSnapshot, RestTimer } from "@/domain/types";
import { getPlatform, IS_ANDROID } from "@/platform";
import type { NotifyPermission } from "@/platform/types";
import { soundOn } from "./signal";

/**
 * APK A5: keeps the phone's own timeline of the rest (domain/rest-signals) in step with the timer. The phone shows it
 * only while the app is away; on screen the page signals itself. No timer, «Пауза», the workout over — cancelled.
 */
export function useRestAlarm(snapshot: RestSnapshot | undefined, items: SignalItem[] | undefined, timer: RestTimer | null | undefined) {
  const last = useRef("");
  const args = useRef({ snapshot, items, timer });
  useEffect(() => {
    args.current = { snapshot, items, timer };
  });

  useEffect(() => {
    if (!IS_ANDROID) return;
    const sync = () => {
      const { snapshot: s, items: its, timer: t } = args.current;
      const signals = restSignals(s, its ?? [], t, Date.now());
      const sound = soundOn();
      // The first step is «now»: its moment changes with every call and does not matter.
      const key = JSON.stringify([sound, signals.map((x, i) => (i === 0 ? { ...x, at: 0 } : x))]);
      if (key === last.current) return;
      last.current = key;
      getPlatform().then((p) => p.restAlarm.schedule(signals, sound).catch(console.error));
    };
    sync();
    // Right before leaving the screen: the sound switch may have changed meanwhile.
    const onHide = () => document.visibilityState === "hidden" && sync();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [snapshot, items, timer]);

  useEffect(
    () => () => {
      if (!IS_ANDROID) return;
      last.current = "";
      getPlatform().then((p) => p.restAlarm.cancel().catch(() => {}));
    },
    [],
  );
}

/** The notification permission, read again whenever the app comes back (it may have been changed in the settings). */
export function useNotifyPermission(): [NotifyPermission | null, (p: NotifyPermission) => void] {
  const [perm, setPerm] = useState<NotifyPermission | null>(null);
  useEffect(() => {
    if (!IS_ANDROID) return;
    let alive = true;
    const read = () => {
      if (document.visibilityState !== "visible") return;
      getPlatform()
        .then((p) => p.notifications.permission())
        .then((s) => alive && setPerm(s))
        .catch(() => {});
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", read);
    };
  }, []);
  return [perm, setPerm];
}
