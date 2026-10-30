"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { formatRest, REST_PRESETS, stepRest } from "@/domain/rest";

interface RestSheetProps {
  open: boolean;
  /** «Между подходами», «Между упражнениями». */
  title: string;
  /** What it applies to: «Рывок гири» or «Весь план». */
  subject: string;
  value: number;
  /** The plan's value, for an exercise's own rest: shows «Как в плане». */
  planValue?: number;
  onSave: (value: number | null) => void;
  onClose: () => void;
}

/** The «Отдых» sheet (mockup О3): −/+ 15 s, ready-made values, «без отдыха», back to the plan's value. */
export function RestSheet({ open, title, subject, value, planValue, onSave, onClose }: RestSheetProps) {
  const [sec, setSec] = useState(value);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Отдых · ${title.toLowerCase()}`}
      footer={
        <div className={planValue !== undefined ? "grid grid-cols-2 gap-2" : "grid"}>
          {planValue !== undefined && (
            <Button variant="outline" onClick={() => onSave(null)}>
              Как в плане · {formatRest(planValue)}
            </Button>
          )}
          <Button variant="primary" onClick={() => onSave(sec)}>
            Готово
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-muted">{subject}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSec((v) => stepRest(v, -1))}
            disabled={sec === 0}
            aria-label="Меньше на 15 секунд"
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] border-ink text-[13px] font-semibold disabled:opacity-40"
          >
            <span className="text-2xl leading-none">−</span>15 с
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span aria-live="polite" className="font-display text-[44px] leading-none font-bold">
              {formatRest(sec)}
            </span>
            <span className="mt-1 text-[13px] text-ink-muted">{sec === 0 ? "без отдыха" : "мин : сек"}</span>
          </div>
          <button
            type="button"
            onClick={() => setSec((v) => stepRest(v, 1))}
            aria-label="Больше на 15 секунд"
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] border-ink text-[13px] font-semibold"
          >
            <span className="text-2xl leading-none">+</span>15 с
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {REST_PRESETS.map((p) => (
            <Chip key={p} on={sec === p} onClick={() => setSec(p)} className="min-h-11 font-mono">
              {formatRest(p)}
            </Chip>
          ))}
        </div>
        <Chip on={sec === 0} onClick={() => setSec(0)} className="min-h-11">
          Без отдыха · 0:00
        </Chip>
      </div>
    </Sheet>
  );
}
