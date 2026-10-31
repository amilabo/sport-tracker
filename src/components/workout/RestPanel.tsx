"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WorkoutItem } from "@/db/repos/workouts";
import { elapsedSec, formatCountdown, remainingSec } from "@/domain/rest-timer";
import { formatRest } from "@/domain/rest";
import { formatSet } from "@/domain/sets";
import { timedCircuit, workSecFor } from "@/domain/timed-circuit";
import type { RestSnapshot, RestTimer } from "@/domain/types";
import { playRestSignal, playTick, primeSignal, setSoundOn, soundOn } from "@/lib/signal";

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
  snapshot: RestSnapshot | undefined;
  /** The screen is kept on (Wake Lock). */
  screenOn: boolean;
  onAdjust: (dir: 1 | -1) => void;
  onStartSet: () => void;
  onFinishSet: () => void;
  onStop: () => void;
  /** Timed circuit (stage 39): «Пауза» / continue, «Закончить раньше» / «Начать сейчас», reps of the set just done. */
  onPause: () => void;
  onSkip: () => void;
  onReps: (weId: string, setId: string, reps: number) => void;
}

const KIND_LABELS: Record<RestTimer["kind"], string> = {
  set: "Отдых между подходами",
  exercise: "Отдых между упражнениями",
  inside: "Отдых в круге",
  round: "Отдых между кругами",
};

/** What comes next: «Подход 3 из 6 · Рывок гири · 24 кг × 10»; in a circuit — «Круг 2 из 3 · Гоблет-присед · 16 кг × 15». */
function nextLine(timer: RestTimer, items: WorkoutItem[]): string {
  const item = items.find((it) => it.we.id === timer.we_id);
  const si = item?.sets.findIndex((s) => s.id === timer.set_id) ?? -1;
  if (!item || si < 0) return "";
  const values = formatSet(item.exercise.log_type, item.sets[si]);
  const where = item.we.circuit_id ? `Круг ${si + 1} из ${item.sets.length}` : `Подход ${si + 1} из ${item.sets.length}`;
  return `${where} · ${item.exercise.name}${values ? ` · ${values}` : ""}`;
}

const HAS_REPS = new Set(["weight_reps", "reps", "bodyweight_plus"]);

/**
 * The timer panel at the bottom of a workout with rest (mockups О4, Т2, Т3): the rest countdown, «Пора», −/+ 15 s,
 * «Начать подход»; while a set is being done — the accent panel and «Готово». In a circuit by time the clock runs the
 * phases by itself: «Пауза», «Закончить раньше» / «Начать сейчас», and «сколько раз?» during the rest.
 */
export function RestPanel(props: RestPanelProps) {
  const { timer, items, snapshot, screenOn, onAdjust, onStartSet, onFinishSet, onStop } = props;
  const now = useNow();
  const [sound, setSound] = useState(soundOn);
  const signaled = useRef<string | null>(null);
  const ticked = useRef<string | null>(null);
  const rest = timer.phase === "rest";
  const target = items.find((it) => it.we.id === timer.we_id);
  const work = workSecFor(snapshot, target);
  // The clock runs this phase by itself: the work of a timed circuit, or a rest inside it.
  const auto = !!work && (!rest || timer.kind === "inside" || timer.kind === "round");
  const left = remainingSec(timer, now);
  const due = rest && left <= 0 && !auto;
  const key = `${timer.since}|${timer.target_sec}|${timer.phase}`;
  const paused = !!timer.paused_at;

  // Three beeps when the rest runs out on screen. Coming back after it ran out — no late beep, only «Пора».
  useEffect(() => {
    if (auto || !rest || left > 0) {
      if (signaled.current === key) signaled.current = null;
      return;
    }
    if (signaled.current === key) return;
    signaled.current = key;
    if (left > -3) playRestSignal();
  }, [auto, rest, left, key]);

  // A timed circuit: one beep 3 s before the end of each phase, three when it changes.
  const lastAuto = useRef<string | null>(null);
  useEffect(() => {
    if (!auto || paused) return;
    if (left <= 3 && left > 0 && ticked.current !== key) {
      ticked.current = key;
      playTick();
    }
  }, [auto, paused, left, key]);
  useEffect(() => {
    if (lastAuto.current && lastAuto.current !== key) playRestSignal();
    lastAuto.current = auto ? key : null;
  }, [auto, key]);

  const tap = (fn: () => void) => () => {
    primeSignal();
    fn();
  };

  if (auto) return <TimedPanel {...props} left={left} work={work!} paused={paused} sound={sound} setSound={setSound} tap={tap} />;

  const next = nextLine(timer, items);
  const label = !rest ? "Подход идёт" : due ? "Пора" : KIND_LABELS[timer.kind];
  // Work is the bright part (stage 39, decision of 30.10): the accent panel while a set is being done.
  const bright = due || !rest;
  const muted = bright ? "text-on-accent" : "text-on-inverse-muted";
  const lineColor = bright ? "border-on-accent" : "border-line-inverse";

  return (
    <section
      aria-label="Таймер отдыха"
      className={`sticky bottom-0 z-30 mt-3 flex flex-col gap-2 rounded-t-[22px] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-colors duration-300 ${
        bright ? "bg-accent text-on-accent" : "bg-surface-inverse text-on-inverse"
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Compact (stage 38): label and timer in one row, so the done exercise and the new one fit above the panel. */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate font-display text-[11px] font-bold tracking-[0.06em] uppercase">{label}</h2>
          <span className={`truncate font-mono text-xs ${muted}`}>
            {!rest ? "идёт подход" : due ? "сверх плана" : `из ${formatRest(timer.target_sec)}`}
            {screenOn && <span className="sr-only">, экран не гаснет</span>}
          </span>
        </div>
        <span role="timer" className="font-display text-[34px] leading-none font-bold tabular-nums">
          {rest ? formatCountdown(left) : formatRest(elapsedSec(timer, now))}
        </span>
        <SoundButton sound={sound} setSound={setSound} lineColor={lineColor} />
        <button
          type="button"
          aria-label="Скрыть таймер"
          onClick={onStop}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] ${lineColor}`}
        >
          <CloseIcon />
        </button>
      </div>

      {next && <p className={`truncate text-sm ${due ? "font-semibold" : muted}`}>{rest ? `Дальше: ${next}` : next}</p>}

      {rest ? (
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={tap(() => onAdjust(-1))} className={`min-h-12 rounded-[14px] border-[1.5px] text-sm font-semibold ${lineColor}`} aria-label="Отдых меньше на 15 секунд">
            −15 с
          </button>
          <button type="button" onClick={tap(() => onAdjust(1))} className={`min-h-12 rounded-[14px] border-[1.5px] text-sm font-semibold ${lineColor}`} aria-label="Отдых больше на 15 секунд">
            +15 с
          </button>
          <button
            type="button"
            onClick={tap(onStartSet)}
            className={`col-span-2 min-h-12 rounded-[14px] font-display text-[15px] font-bold active:scale-[0.98] ${
              due ? "bg-surface-inverse text-on-inverse" : "bg-accent text-on-accent"
            }`}
          >
            Начать подход
          </button>
        </div>
      ) : (
        <button type="button" onClick={tap(onFinishSet)} className="min-h-12 rounded-[14px] bg-surface-inverse font-display text-[15px] font-bold text-on-inverse active:scale-[0.98]">
          Готово — подход сделан
        </button>
      )}
    </section>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SoundButton({ sound, setSound, lineColor }: { sound: boolean; setSound: (on: boolean) => void; lineColor: string }) {
  return (
    <button
      type="button"
      aria-pressed={sound}
      aria-label="Звук сигнала"
      onClick={() => {
        primeSignal();
        setSoundOn(!sound);
        setSound(!sound);
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] ${lineColor}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {sound ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
      </svg>
    </button>
  );
}

interface TimedPanelProps extends RestPanelProps {
  left: number;
  work: number;
  paused: boolean;
  sound: boolean;
  setSound: (on: boolean) => void;
  tap: (fn: () => void) => () => void;
}

/** Т2 (work: the accent panel) and Т3 (rest: the dark one, «сколько раз?»). */
function TimedPanel({ timer, items, snapshot, screenOn, onStop, onPause, onSkip, onReps, left, work, paused, sound, setSound, tap }: TimedPanelProps) {
  const rest = timer.phase === "rest";
  const circuit = timedCircuit(snapshot, items.find((it) => it.we.id === timer.we_id)?.we.circuit_id);
  const target = items.find((it) => it.we.id === timer.we_id);
  const total = timer.target_sec;
  const progress = total > 0 ? Math.min(1, Math.max(0, (total - Math.max(0, left)) / total)) : 0;
  const lineColor = rest ? "border-line-inverse" : "border-on-accent";
  const muted = rest ? "text-on-inverse-muted" : "text-on-accent";

  // What comes after the work: «отдых 0:20 → Отжимания от пола» (or the round rest, or the end).
  let after = "";
  if (!rest && target && circuit) {
    const members = items.filter((it) => it.we.circuit_id === circuit.id && !it.we.skipped);
    const si = target.sets.findIndex((s) => s.id === timer.set_id);
    const pos = members.findIndex((m) => m.we.id === target.we.id);
    const lastInRound = pos === members.length - 1;
    const lastRound = si === Math.max(...members.map((m) => m.sets.length)) - 1;
    if (lastInRound && lastRound) after = "Дальше: конец круга.";
    else {
      const nextName = lastInRound ? members[0]?.exercise.name : members[pos + 1]?.exercise.name;
      const restSec = lastInRound ? circuit.rest_round_sec : circuit.rest_inside_sec;
      after = `Дальше: ${restSec > 0 ? `отдых ${formatRest(restSec)} → ` : ""}${nextName}.`;
    }
  }

  // «сколько раз?» for the set just done (Т3).
  const from = rest ? items.find((it) => it.we.id === timer.from_we_id) : undefined;
  const fromSet = from?.sets.find((s) => s.id === timer.from_set_id);
  const askReps = from && fromSet && HAS_REPS.has(from.exercise.log_type) ? { item: from, set: fromSet } : null;
  const prefilled = askReps && askReps.set.reps !== null && askReps.set.position > 0 && from!.sets[askReps.set.position - 1]?.reps === askReps.set.reps;

  return (
    <section
      aria-label={rest ? "Отдых" : "Работа"}
      className={`sticky bottom-0 z-30 mt-3 flex flex-col gap-2.5 rounded-t-[24px] px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] transition-colors duration-300 ${
        rest ? "bg-surface-inverse text-on-inverse" : "bg-accent text-on-accent"
      }`}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${rest ? "bg-on-inverse-muted" : "bg-on-accent"}`} />
        <h2 className={`min-w-0 flex-1 truncate font-display text-xs font-bold tracking-[0.06em] uppercase ${rest ? "text-on-inverse-muted" : ""}`}>
          {paused ? "Пауза · " : ""}
          {rest ? KIND_LABELS[timer.kind] : `Работа · ${target?.exercise.name ?? ""}`}
          {screenOn && <span className="sr-only">, экран не гаснет</span>}
        </h2>
        {rest && (
          <span className="flex items-baseline gap-1.5">
            <span role="timer" className="font-display text-[30px] leading-none font-extrabold tabular-nums">
              {formatRest(Math.max(0, left))}
            </span>
            <span className="font-mono text-[13px] text-on-inverse-muted">из {formatRest(total)}</span>
          </span>
        )}
        <SoundButton sound={sound} setSound={setSound} lineColor={lineColor} />
        <button type="button" aria-label="Остановить таймер круга" onClick={onStop} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] ${lineColor}`}>
          <CloseIcon />
        </button>
      </div>

      {!rest && (
        <div className="flex items-baseline gap-2.5">
          <span role="timer" className="font-display text-[64px] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
            {formatRest(Math.max(0, left))}
          </span>
          <span className="font-mono text-[15px] font-bold">из {formatRest(work)}</span>
        </div>
      )}
      <div aria-hidden="true" className={`h-2 overflow-hidden rounded-full border ${rest ? "border-line-inverse" : "border-on-accent"}`}>
        <div className={`h-full ${rest ? "bg-on-inverse-muted" : "bg-on-accent"}`} style={{ width: `${progress * 100}%` }} />
      </div>

      {askReps && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line-inverse p-3">
          <span className="text-sm font-semibold">{askReps.item.exercise.name} — сколько раз?</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Меньше раз"
              onClick={() => onReps(askReps.item.we.id, askReps.set.id, Math.max(0, (askReps.set.reps ?? 0) - 1))}
              className="h-13 w-13 rounded-[14px] border-[1.5px] border-line-inverse text-[22px] font-bold"
            >
              −
            </button>
            <span aria-live="polite" className="flex-1 text-center font-display text-[34px] leading-none font-extrabold tabular-nums">
              {askReps.set.reps ?? "—"}
            </span>
            <button
              type="button"
              aria-label="Больше раз"
              onClick={() => onReps(askReps.item.we.id, askReps.set.id, Math.min(999, (askReps.set.reps ?? 0) + 1))}
              className="h-13 w-13 rounded-[14px] border-[1.5px] border-line-inverse text-[22px] font-bold"
            >
              +
            </button>
          </div>
          <span className="text-xs text-on-inverse-muted">{prefilled ? "подставлено, как в прошлом круге · " : ""}можно вписать и позже в карточке</span>
        </div>
      )}

      <p className={`text-sm leading-snug ${rest ? muted : "font-semibold"}`}>
        {rest ? `Дальше: ${target?.exercise.name ?? ""} — 3, 2, 1 и старт сам` : `${after} Сигнал за 3 секунды до конца.`}
      </p>

      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <button type="button" onClick={tap(onPause)} className={`min-h-13 rounded-[14px] border-[1.5px] text-[15px] font-semibold ${lineColor}`}>
          {paused ? "Продолжить" : "Пауза"}
        </button>
        <button
          type="button"
          onClick={tap(onSkip)}
          className={`min-h-13 rounded-[14px] text-[15px] font-bold active:scale-[0.98] ${rest ? "bg-accent text-on-accent" : "bg-surface-inverse text-on-inverse"}`}
        >
          {rest ? "Начать сейчас" : "Закончить раньше"}
        </button>
      </div>
    </section>
  );
}
