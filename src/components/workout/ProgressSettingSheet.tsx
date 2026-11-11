"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { exercisesRepo } from "@/db/repos/exercises";
import { REP_CEILING_MAX, REP_CEILING_MIN } from "@/domain/analytics/progress-settings";
import { formatNumber, parseDecimal } from "@/domain/format";
import { DomainError, type Id } from "@/domain/types";

export interface ProgressSettingTarget {
  exerciseId: Id;
  exerciseName: string;
  kind: "step" | "ceiling";
  value: number;
  /** The exercise has a weight: at the ceiling a heavier weight is offered too. */
  weighted: boolean;
}

const STEPS = [1, 2.5, 5];

/**
 * «шаг веса 5 кг · изменить» / «потолок 15 · изменить» under the choices of «Обновить план?» (stage 52, mockup Р1):
 * one field, saved to the exercise right away — the same setting as «Как прибавлять» on the exercise screen.
 */
export function ProgressSettingSheet({ target, onClose, onSaved }: { target: ProgressSettingTarget | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet open={!!target} onClose={onClose} title={target?.kind === "ceiling" ? "Потолок повторов" : "Шаг веса"}>
      {target && <SettingForm key={`${target.exerciseId}:${target.kind}`} target={target} onSaved={onSaved} />}
    </Sheet>
  );
}

function SettingForm({ target, onSaved }: { target: ProgressSettingTarget; onSaved: () => void }) {
  const ceiling = target.kind === "ceiling";
  const [n, setN] = useState(target.value);
  const [own, setOwn] = useState(STEPS.includes(target.value) ? "" : formatNumber(target.value, 2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const value = ceiling ? n : own.trim() ? parseDecimal(own) : n;
    if (value === null) return setError("Введите шаг числом, например 1,25");
    setBusy(true);
    try {
      await exercisesRepo.setProgress(target.exerciseId, ceiling ? { rep_ceiling: value } : { weight_step: value });
      onSaved();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-1">
      <p className="text-[15px] leading-snug">
        {target.exerciseName}.{" "}
        <span className="text-ink-muted">
          {ceiling
            ? `Дошли до потолка — вместо +1 повтора предложим ${target.weighted ? "подход или вес побольше с меньшими повторами" : "ещё подход"}.`
            : "На столько предлагаем прибавить вес."}{" "}
          Действует во всех планах.
        </span>
      </p>
      {ceiling ? (
        <div className="flex items-center justify-center gap-4">
          <Button aria-label="Меньше" onClick={() => setN((v) => Math.max(REP_CEILING_MIN, v - 1))} disabled={n <= REP_CEILING_MIN} className="w-14">
            −
          </Button>
          <span className="min-w-16 text-center font-display text-[34px] leading-none font-extrabold" aria-live="polite">
            {n}
          </span>
          <Button aria-label="Больше" onClick={() => setN((v) => Math.min(REP_CEILING_MAX, v + 1))} disabled={n >= REP_CEILING_MAX} className="w-14">
            +
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <Chip
                key={s}
                on={!own.trim() && n === s}
                onClick={() => {
                  setN(s);
                  setOwn("");
                }}
              >
                {formatNumber(s)} кг
              </Chip>
            ))}
          </div>
          <Field label="Свой шаг, кг" inputMode="decimal" placeholder="например 1,25" value={own} onChange={(e) => setOwn(e.target.value)} />
        </div>
      )}
      <FormError message={error} />
      <Button variant="primary" onClick={save} disabled={busy}>
        Сохранить
      </Button>
    </div>
  );
}
