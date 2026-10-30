"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WorkoutItem } from "@/db/repos/workouts";
import { elapsedSec, formatCountdown, remainingSec } from "@/domain/rest-timer";
import { formatRest } from "@/domain/rest";
import { formatSet } from "@/domain/sets";
import type { RestTimer } from "@/domain/types";
import { playRestSignal, primeSignal, setSoundOn, soundOn } from "@/lib/signal";

/** Re-renders 4 times a second while the panel is on screen. */
function useNow() {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 250);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 250) * 250,
    () => 0,
  );
}

interface RestPanelProps {
  timer: RestTimer;
  items: WorkoutItem[];
  /** The screen is kept on (Wake Lock). */
  screenOn: boolean;
  onAdjust: (dir: 1 | -1) => void;
  onStartSet: () => void;
  onFinishSet: () => void;
  onStop: () => void;
}

/** What comes next: «Подход 3 из 6 · Рывок гири · 24 кг × 10». */
function nextLine(timer: RestTimer, items: WorkoutItem[]): string {
  const item = items.find((it) => it.we.id === timer.we_id);
  const si = item?.sets.findIndex((s) => s.id === timer.set_id) ?? -1;
  if (!item || si < 0) return "";
  const values = formatSet(item.exercise.log_type, item.sets[si]);
  return `Подход ${si + 1} из ${item.sets.length} · ${item.exercise.name}${values ? ` · ${values}` : ""}`;
}

/**
 * The rest panel at the bottom of a workout with rest (mockup О4): countdown, «Пора» and time over the plan,
 * −/+ 15 s, «Начать подход»; while a set is being done — its time and «Готово».
 */
export function RestPanel({ timer, items, screenOn, onAdjust, onStartSet, onFinishSet, onStop }: RestPanelProps) {
  const now = useNow();
  const [sound, setSound] = useState(soundOn);
  const signaled = useRef<string | null>(null);
  const rest = timer.phase === "rest";
  const left = remainingSec(timer, now);
  const due = rest && left <= 0;

  // Three beeps when the rest runs out on screen. Coming back after it ran out — no late beep, only «Пора».
  useEffect(() => {
    const key = `${timer.since}|${timer.target_sec}`;
    if (!rest || left > 0) {
      if (signaled.current === key) signaled.current = null;
      return;
    }
    if (signaled.current === key) return;
    signaled.current = key;
    if (left > -3) playRestSignal();
  }, [rest, left, timer.since, timer.target_sec]);

  const next = nextLine(timer, items);
  const label = !rest ? "Подход идёт" : due ? "Пора" : timer.kind === "set" ? "Отдых между подходами" : "Отдых между упражнениями";
  const muted = due ? "text-on-accent" : "text-on-inverse-muted";
  const lineColor = due ? "border-on-accent" : "border-line-inverse";
  const tap = (fn: () => void) => () => {
    primeSignal();
    fn();
  };

  return (
    <section
      aria-label="Таймер отдыха"
      className={`sticky bottom-0 z-30 mt-3 flex flex-col gap-2.5 rounded-t-[22px] px-4 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))] transition-colors duration-300 ${
        due ? "bg-accent text-on-accent" : "bg-surface-inverse text-on-inverse"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="font-display text-[11px] font-bold tracking-[0.06em] uppercase">{label}</h2>
          {screenOn && <span className={`text-xs ${muted}`}>экран не гаснет</span>}
        </div>
        <button
          type="button"
          aria-pressed={sound}
          aria-label="Звук в конце отдыха"
          onClick={() => {
            primeSignal();
            setSoundOn(!sound);
            setSound(!sound);
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] ${lineColor}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            {sound ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
          </svg>
        </button>
        <button
          type="button"
          aria-label="Скрыть таймер"
          onClick={onStop}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] ${lineColor}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex items-baseline gap-3">
        <span role="timer" className="font-display text-[44px] leading-none font-bold tabular-nums">
          {rest ? formatCountdown(left) : formatRest(elapsedSec(timer, now))}
        </span>
        <span className={`font-mono text-sm ${muted}`}>
          {!rest ? "идёт подход" : due ? "сверх плана" : `из ${formatRest(timer.target_sec)}`}
        </span>
      </div>
      {next && <p className={`text-sm leading-snug ${due ? "font-semibold" : muted}`}>{rest ? `Дальше: ${next}` : next}</p>}

      {rest ? (
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={tap(() => onAdjust(-1))} className={`min-h-13 rounded-[14px] border-[1.5px] text-sm font-semibold ${lineColor}`} aria-label="Отдых меньше на 15 секунд">
            −15 с
          </button>
          <button type="button" onClick={tap(() => onAdjust(1))} className={`min-h-13 rounded-[14px] border-[1.5px] text-sm font-semibold ${lineColor}`} aria-label="Отдых больше на 15 секунд">
            +15 с
          </button>
          <button
            type="button"
            onClick={tap(onStartSet)}
            className={`col-span-2 min-h-13 rounded-[14px] font-display text-[15px] font-bold active:scale-[0.98] ${
              due ? "bg-surface-inverse text-on-inverse" : "bg-accent text-on-accent"
            }`}
          >
            Начать подход
          </button>
        </div>
      ) : (
        <button type="button" onClick={tap(onFinishSet)} className="min-h-13 rounded-[14px] bg-accent font-display text-[15px] font-bold text-on-accent active:scale-[0.98]">
          Готово — подход сделан
        </button>
      )}
    </section>
  );
}
