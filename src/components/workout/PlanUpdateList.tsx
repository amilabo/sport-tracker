"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PlanChange } from "@/domain/plan-diff";

interface PlanUpdateListProps {
  planName: string;
  changes: PlanChange[];
  /** Called with the checked lines; an empty list means "не обновлять". */
  onDecide: (checked: PlanChange[]) => void;
  busy?: boolean;
}

/** «Обновить веса в плане?» (PRD §3.5): every line has its own checkbox, all unchecked by default. */
export function PlanUpdateList({ planName, changes, onDecide, busy }: PlanUpdateListProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const count = checked.size;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-snug text-ink-muted">
        На тренировке вы сделали не так, как в плане. Отметьте, что перенести в план «{planName}».
      </p>
      <ul className="flex flex-col">
        {changes.map((c) => {
          const on = checked.has(c.key);
          return (
            <li key={c.key} className="border-t border-line">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })
                  }
                  className="h-6 w-6 shrink-0 accent-[var(--ink)]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] leading-tight font-semibold">{c.exerciseName}</span>
                  <span className="text-[13px] text-ink-muted">{c.where}</span>
                </span>
                <span className="ml-auto shrink-0 text-right font-mono text-sm font-bold whitespace-nowrap">
                  <span className="text-ink-faint line-through">{c.from}</span> → {c.to}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => onDecide(changes.filter((c) => checked.has(c.key)))} disabled={busy || count === 0}>
          Обновить отмеченные
        </Button>
        <Button variant="outline" onClick={() => onDecide([])} disabled={busy}>
          Не обновлять
        </Button>
      </div>
    </div>
  );
}
