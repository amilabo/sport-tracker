"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { formatRest, REST_PRESETS, stepRest } from "@/domain/rest";

/** Work of a circuit by time (stage 39): 5 s steps, at least 0:05, no «без отдыха». */
const WORK_PRESETS = [20, 30, 40, 45, 60, 90] as const;
const WORK_STEP = 5;
const WORK_MIN = 5;
const WORK_MAX = 600;

interface RestSheetProps {
  open: boolean;
  /** «Между подходами», «Между упражнениями». */
  title: string;
  /** What it applies to: «Рывок гири» or «Весь план». */
  subject: string;
  value: number;
  /** The plan's value, for an exercise's own rest: shows «Как в плане». */
  planValue?: number;
  /** The work time of a circuit by time, not a rest. */
  work?: boolean;
  onSave: (value: number | null) => void;
  onClose: () => void;
}

/** The «Отдых» sheet (mockup О3): −/+ 15 s, ready-made values, «без отдыха», back to the plan's value. */
export function RestSheet({ open, title, subject, value, planValue, work, onSave, onClose }: RestSheetProps) {
  const [sec, setSec] = useState(value);
  const step = work ? WORK_STEP : 15;
  const min = work ? WORK_MIN : 0;
  const move = (dir: 1 | -1) =>
    setSec((v) => (work ? Math.max(WORK_MIN, Math.min(WORK_MAX, (dir > 0 ? Math.floor(v / step) : Math.ceil(v / step)) * step + dir * step)) : stepRest(v, dir)));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={work ? title : `Отдых · ${title.toLowerCase()}`}
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
            onClick={() => move(-1)}
            disabled={sec <= min}
            aria-label={`Меньше на ${step} секунд`}
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] border-ink text-[13px] font-semibold disabled:opacity-40"
          >
            <span className="text-2xl leading-none">−</span>
            {step} с
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span aria-live="polite" className="font-display text-[44px] leading-none font-bold">
              {formatRest(sec)}
            </span>
            <span className="mt-1 text-[13px] text-ink-muted">{sec === 0 && !work ? "без отдыха" : "мин : сек"}</span>
          </div>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={work && sec >= WORK_MAX}
            aria-label={`Больше на ${step} секунд`}
            className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-[1.5px] border-ink text-[13px] font-semibold"
          >
            <span className="text-2xl leading-none">+</span>
            {step} с
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(work ? WORK_PRESETS : REST_PRESETS).map((p) => (
            <Chip key={p} on={sec === p} onClick={() => setSec(p)} className="min-h-11 font-mono">
              {formatRest(p)}
            </Chip>
          ))}
        </div>
        {!work && (
          <Chip on={sec === 0} onClick={() => setSec(0)} className="min-h-11">
            Без отдыха · 0:00
          </Chip>
        )}
      </div>
    </Sheet>
  );
}
