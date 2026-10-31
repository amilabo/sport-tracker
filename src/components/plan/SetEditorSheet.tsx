"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { formatNumber, parseDecimal } from "@/domain/format";
import type { LogType, SetValues } from "@/domain/types";

interface SetEditorSheetProps {
  open: boolean;
  title: string;
  logType: LogType;
  value: SetValues;
  canDelete: boolean;
  /** A circuit by time (stage 39): only the weight is planned, the rest of the set stays as it is. */
  weightOnly?: boolean;
  onSave: (value: SetValues) => void;
  onDelete: () => void;
  onClose: () => void;
}

const num = (v: number | null) => (v === null ? "" : formatNumber(v, 2));

/** Edits one set's values. Fields depend on the exercise log type. */
export function SetEditorSheet(props: SetEditorSheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title}>
      {/* Keyed by title so the fields reset for each set. */}
      {props.open && <SetEditorForm key={props.title} {...props} />}
    </Sheet>
  );
}

function SetEditorForm({ logType, value, canDelete, weightOnly, onSave, onDelete }: SetEditorSheetProps) {
  const [weight, setWeight] = useState(num(value.weight === null ? null : Math.abs(value.weight)));
  const [assist, setAssist] = useState((value.weight ?? 0) < 0);
  const [reps, setReps] = useState(value.reps === null ? "" : String(value.reps));
  const dur = value.duration_sec ?? 0;
  const [min, setMin] = useState(value.duration_sec === null ? "" : String(Math.floor(dur / 60)));
  const [sec, setSec] = useState(value.duration_sec === null ? "" : String(dur % 60));
  const [speed, setSpeed] = useState(num(value.speed_kmh));
  const [error, setError] = useState<string | null>(null);

  const usesWeight = logType === "weight_reps" || logType === "bodyweight_plus";
  const usesReps = !weightOnly && (usesWeight || logType === "reps");
  const usesTime = !weightOnly && (logType === "time" || logType === "cardio");

  function save(e: React.FormEvent) {
    e.preventDefault();
    const next: SetValues = weightOnly ? { ...value, weight: null } : { weight: null, reps: null, duration_sec: null, speed_kmh: null };
    if (usesWeight && weight.trim()) {
      const w = parseDecimal(weight);
      if (w === null || w < 0 || w > 999) return setError("Вес — число, например 42,5");
      next.weight = logType === "bodyweight_plus" && assist ? -w : w;
    }
    if (usesReps) {
      const r = Number(reps);
      if (!Number.isInteger(r) || r < 1 || r > 999) return setError("Укажите количество раз");
      next.reps = r;
    }
    if (usesTime) {
      const m = min.trim() ? Number(min) : 0;
      const s = sec.trim() ? Number(sec) : 0;
      if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59 || m * 60 + s <= 0) {
        return setError("Укажите время: минуты и секунды");
      }
      next.duration_sec = m * 60 + s;
    }
    if (!weightOnly && logType === "cardio" && speed.trim()) {
      const v = parseDecimal(speed);
      if (v === null || v <= 0 || v > 50) return setError("Скорость — число, например 9,5");
      next.speed_kmh = v;
    }
    onSave(next);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {logType === "bodyweight_plus" && (
        <div role="radiogroup" aria-label="Знак веса" className="grid grid-cols-2 gap-1.5 rounded-2xl border-[1.5px] border-ink p-1">
          {[
            { on: !assist, label: "+ доп. вес", set: false },
            { on: assist, label: "− помощь", set: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={o.on}
              onClick={() => setAssist(o.set)}
              className={`min-h-11 rounded-xl text-sm font-semibold ${o.on ? "bg-surface-inverse text-on-inverse" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {usesWeight && (
          <Field label={logType === "bodyweight_plus" ? "Кг" : "Вес, кг"} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
        )}
        {usesReps && <Field label="Раз" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />}
        {usesTime && (
          <>
            <Field label="Минуты" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />
            <Field label="Секунды" inputMode="numeric" value={sec} onChange={(e) => setSec(e.target.value)} placeholder="0" />
          </>
        )}
        {!weightOnly && logType === "cardio" && (
          <Field label="Скорость, км/ч" inputMode="decimal" value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="—" />
        )}
      </div>
      <FormError message={error} />
      <div className={weightOnly ? "grid" : "grid grid-cols-2 gap-2"}>
        {!weightOnly && (
          <Button variant="quiet" disabled={!canDelete} onClick={onDelete}>
            Удалить подход
          </Button>
        )}
        <Button variant="primary" type="submit">
          Готово
        </Button>
      </div>
    </form>
  );
}
