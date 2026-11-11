"use client";

import { useState } from "react";
import { FormError, inputClass } from "@/components/ui/Field";
import { exercisesRepo, type ProgressSettingsPatch } from "@/db/repos/exercises";
import {
  REP_CEILING_DEFAULT,
  REP_CEILING_DEFAULT_REPS,
  REP_CEILING_MAX,
  REP_CEILING_MIN,
  cleanCeiling,
  cleanStep,
  perSide,
  stepOf,
} from "@/domain/analytics/progress-settings";
import { weightStep } from "@/domain/analytics/weight-step";
import { formatNumber, parseDecimal } from "@/domain/format";
import { DomainError, type Exercise } from "@/domain/types";

const STEPS = [1, 2.5, 5];

/** The block shows for exercises «Обновить план?» can progress (stage 51а). */
export function hasProgressSettings(exercise: Pick<Exercise, "log_type">): boolean {
  return exercise.log_type === "weight_reps" || exercise.log_type === "reps";
}

/**
 * «Как прибавлять» (stage 53, mockup Р4): settings of the exercise used by «Обновить план?» in every plan — the ceiling
 * of reps, own weight step, «на каждую сторону», what to offer first. Folded into one line until something is set.
 */
export function ProgressSettings({ exercise }: { exercise: Exercise }) {
  const weighted = exercise.log_type === "weight_reps";
  const ownCeiling = cleanCeiling(exercise.rep_ceiling);
  const ownStep = cleanStep(exercise.weight_step);
  const side = perSide(exercise);
  const byDefault = exercise.log_type === "reps" ? REP_CEILING_DEFAULT_REPS : REP_CEILING_DEFAULT;
  const ceiling = ownCeiling ?? byDefault;
  const step = stepOf(exercise);
  const equipmentStep = weightStep(exercise.equipment);
  const touched = ownCeiling !== null || ownStep !== null || side;

  const [open, setOpen] = useState(touched);
  const [ownOpen, setOwnOpen] = useState(ownStep !== null && !STEPS.includes(ownStep));
  const [ownText, setOwnText] = useState(ownStep !== null && !STEPS.includes(ownStep) ? formatNumber(ownStep, 2) : "");
  const [error, setError] = useState<string | null>(null);

  async function save(patch: ProgressSettingsPatch) {
    setError(null);
    try {
      await exercisesRepo.setProgress(exercise.id, patch);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
    }
  }
  // The default value is stored as «nothing set»: then a change of the defaults reaches this exercise too.
  const setCeiling = (n: number) => save({ rep_ceiling: n === byDefault ? null : n });
  const setStep = (n: number) => save({ weight_step: n === equipmentStep ? null : n });

  const summary = [`потолок ${ceiling}${side ? " на сторону" : ""}`, weighted ? `шаг ${formatNumber(step, 2)} кг` : null].filter(Boolean).join(" · ");
  const rowTitle = "text-[15px] font-semibold";
  const hint = "text-xs leading-snug text-ink-muted";
  const choice = (on: boolean) =>
    `min-h-11 rounded-[10px] text-sm font-semibold transition-colors ${on ? "border-2 border-selected bg-selected text-on-selected" : "border-[1.5px] border-line-strong text-ink"}`;

  if (!open) {
    // Folded like «Как делать» and «Чем заменить» above: icon, title, the current settings in grey.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="mx-4 mt-3 flex min-h-14 items-start gap-3 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inverse text-on-inverse">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 17l5-5 4 4 7-8" />
            <path d="M15 8h5v5" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
          <span className="font-display text-xs font-bold tracking-[0.04em] uppercase">Как прибавлять</span>
          <span className="text-[13px] leading-[1.4] text-ink-muted">{summary}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-2 shrink-0">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    );
  }

  return (
    <section aria-label="Как прибавлять" className="mx-4 mt-3 flex flex-col rounded-2xl border-2 border-ink bg-surface px-3.5 pt-2 pb-1.5">
      <button type="button" onClick={() => setOpen(false)} aria-expanded className="flex min-h-11 items-center justify-between text-left">
        <span className="font-display text-sm font-extrabold uppercase">Как прибавлять</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>

      <div className="flex items-center gap-2.5 border-b border-line py-2.5">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className={rowTitle}>Потолок повторов{side ? " на сторону" : ""}</span>
          <span className={hint}>дошли — предложим подход{weighted ? " или вес" : ""}{ownCeiling === null ? ` · по умолчанию ${byDefault}` : ""}</span>
        </div>
        <button type="button" aria-label="Меньше" disabled={ceiling <= REP_CEILING_MIN} onClick={() => setCeiling(ceiling - 1)} className="h-11 w-11 rounded-xl border-[1.5px] border-line-strong text-xl font-bold disabled:opacity-40">
          −
        </button>
        <span className="w-9 text-center font-display text-xl font-extrabold" aria-live="polite">
          {ceiling}
        </span>
        <button type="button" aria-label="Больше" disabled={ceiling >= REP_CEILING_MAX} onClick={() => setCeiling(ceiling + 1)} className="h-11 w-11 rounded-xl border-[1.5px] border-line-strong text-xl font-bold disabled:opacity-40">
          +
        </button>
      </div>

      {weighted && (
        <div className="flex flex-col gap-2 border-b border-line py-2.5">
          <div className="flex flex-col gap-0.5">
            <span className={rowTitle}>Шаг веса</span>
            <span className={hint}>
              для этого снаряда обычно {formatNumber(equipmentStep, 2)} кг{ownStep !== null ? ` — здесь ${formatNumber(ownStep, 2)}` : ""}
            </span>
          </div>
          <div role="radiogroup" aria-label="Шаг веса" className="grid grid-cols-4 gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={!ownOpen && step === s}
                onClick={() => {
                  setOwnOpen(false);
                  setStep(s);
                }}
                className={`font-mono ${choice(!ownOpen && step === s)}`}
              >
                {formatNumber(s)}
                {!ownOpen && step === s ? " кг" : ""}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={ownOpen} onClick={() => setOwnOpen(true)} className={choice(ownOpen)}>
              свой
            </button>
          </div>
          {ownOpen && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseDecimal(ownText);
                if (n === null) return setError("Введите шаг числом, например 1,25");
                setStep(n);
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Свой шаг, кг</span>
                <input className={inputClass} inputMode="decimal" placeholder="например 1,25 кг" value={ownText} onChange={(e) => setOwnText(e.target.value)} />
              </label>
              <button type="submit" className="min-h-12 rounded-xl bg-surface-inverse px-4 text-sm font-bold text-on-inverse">
                Готово
              </button>
            </form>
          )}
        </div>
      )}

      <button type="button" role="switch" aria-checked={side} onClick={() => save({ per_side: !side })} className="flex items-center gap-2.5 border-b border-line py-3 text-left">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className={rowTitle}>На каждую сторону</span>
          <span className={hint}>в плане пишете сумму: 24 = по 12; потолок и +1 — на сторону</span>
        </span>
        <span aria-hidden="true" className={`flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors ${side ? "justify-end bg-accent" : "justify-start bg-line-strong"}`}>
          <span className="block h-[26px] w-[26px] rounded-full bg-surface" />
        </span>
      </button>

      {weighted && (
        <div className="flex flex-col gap-2 py-2.5">
          <div className="flex flex-col gap-0.5">
            <span className={rowTitle}>Сначала предлагать</span>
            <span className={hint}>меняется само, когда выбираете в «Обновить план?»</span>
          </div>
          <div role="radiogroup" aria-label="Сначала предлагать" className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["reps", "Повторы"],
                ["weight", "Вес"],
              ] as const
            ).map(([value, label]) => {
              const on = (exercise.progress_prefer ?? "weight") === value;
              return (
                <button key={value} type="button" role="radio" aria-checked={on} onClick={() => save({ progress_prefer: value })} className={choice(on)}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <FormError message={error} />
    </section>
  );
}
