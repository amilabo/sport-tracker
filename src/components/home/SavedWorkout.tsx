"use client";

import { useEffect, useState } from "react";
import { formatKg } from "@/domain/summary";

const KEY = "st-just-saved";

export interface SavedInfo {
  title: string;
  percent: number;
  volumeKg: number;
  duration: string | null;
}

/** Called by the finish screen right before it returns to the home screen. */
export function rememberSaved(info: SavedInfo) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    // no storage: no celebration, the workout is saved anyway
  }
}

/** The finish micro-animation (PRD §7): a card that pops in with a self-drawing check, then fades away. */
export function SavedWorkout() {
  const [info, setInfo] = useState<SavedInfo | null>(null);

  useEffect(() => {
    let saved: SavedInfo | null = null;
    try {
      const raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      saved = raw ? (JSON.parse(raw) as SavedInfo) : null;
    } catch {
      saved = null;
    }
    if (saved) Promise.resolve().then(() => setInfo(saved));
  }, []);

  // A separate effect, so the card always hides — also when the read above runs twice in development.
  useEffect(() => {
    if (!info) return;
    const hide = setTimeout(() => setInfo(null), 4500);
    return () => clearTimeout(hide);
  }, [info]);

  if (!info) return null;
  return (
    <section role="status" className="saved-pop flex items-center gap-3.5 rounded-[22px] bg-surface-inverse p-4 text-on-inverse">
      <span className="check-ring flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" data-done>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="check-draw">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-[17px] leading-tight font-extrabold">Тренировка сохранена</span>
        <span className="font-mono text-[13px] text-on-inverse-muted">
          {info.title} · {info.percent}%{info.volumeKg > 0 ? ` · ${formatKg(info.volumeKg)} кг` : ""}
          {info.duration ? ` · ${info.duration}` : ""}
        </span>
      </span>
    </section>
  );
}
