"use client";

import { useState } from "react";
import { useNotifyPermission } from "@/lib/rest-alarm";
import { getPlatform, IS_ANDROID } from "@/platform";

const HIDDEN_KEY = "st-notify-ask-hidden";

function hiddenFor(workoutId: string): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === workoutId;
  } catch {
    return false;
  }
}

/**
 * APK A5, mockup С1: in the rest panel, until notifications are on — «Сигнал, даже если свернуть приложение»
 * with «Разрешить» (Android's dialog) / «Не сейчас»; turned off for good — a line with «Включить» (the settings).
 * Either is hidden until the next workout by «Не сейчас» or ×.
 */
export function NotifyAsk({ workoutId }: { workoutId: string }) {
  const [perm, setPerm] = useNotifyPermission();
  const [hidden, setHidden] = useState(() => hiddenFor(workoutId));
  if (!IS_ANDROID || hidden || !perm || perm === "granted") return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, workoutId);
    } catch {
      // Private mode: hidden until the panel closes.
    }
    setHidden(true);
  };

  if (perm === "denied") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-line-inverse py-2.5 pr-1 pl-3">
        <span className="flex-1 text-[13px] leading-snug text-on-inverse-muted">Уведомления выключены: если свернуть приложение, сигнала не будет.</span>
        <button
          type="button"
          onClick={() => getPlatform().then((p) => p.notifications.openSettings())}
          className="min-h-11 shrink-0 rounded-xl border-[1.5px] border-on-inverse px-3 text-sm font-semibold"
        >
          Включить
        </button>
        <button type="button" aria-label="Скрыть до следующей тренировки" onClick={hide} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-inverse-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line-inverse p-3">
      <div className="flex items-start gap-2.5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-accent-on-inverse">
          <path d="M6 15V11a6 6 0 0 1 12 0v4l1.5 2.5h-15z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-tight font-bold">Сигнал, даже если свернуть приложение</span>
          <span className="text-[13px] leading-snug text-on-inverse-muted">
            Придёт уведомлением: «пи-пи-пи» в наушниках поверх музыки и вибрация. Android спросит разрешение один раз.
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={hide} className="min-h-11 rounded-xl border-[1.5px] border-line-inverse text-sm font-semibold">
          Не сейчас
        </button>
        <button
          type="button"
          onClick={() =>
            getPlatform()
              .then((p) => p.notifications.request())
              .then(setPerm)
              .catch(() => {})
          }
          className="min-h-11 rounded-xl bg-accent text-sm font-bold text-on-accent"
        >
          Разрешить
        </button>
      </div>
    </div>
  );
}
