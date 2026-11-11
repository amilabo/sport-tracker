"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { choose, type PlanChange } from "@/domain/plan-diff";
import { ProgressSettingSheet, type ProgressSettingTarget } from "./ProgressSettingSheet";

interface PlanUpdateListProps {
  planName: string;
  changes: PlanChange[];
  /** Called with the checked lines, the chosen ways applied; an empty list means "не обновлять". */
  onDecide: (checked: PlanChange[]) => void;
  /** A step or ceiling was changed under the choices: the changes are to be read anew. */
  onSettingSaved?: () => void;
  busy?: boolean;
}

const isWeight = (kind: string) => kind === "weight" || kind === "weight_reset";

/**
 * «Обновить план?» (PRD §3.5): every line has its own checkbox, all unchecked by default. A progress line (stage 52,
 * mockup Р1) offers ways to add — the first is chosen; choosing one checks the line. One way only — a plain line.
 */
export function PlanUpdateList({ planName, changes, onDecide, onSettingSaved, busy }: PlanUpdateListProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Map<string, number>>(new Map());
  const [setting, setSetting] = useState<ProgressSettingTarget | null>(null);
  const count = checked.size;
  const anyProgress = changes.some((c) => c.progress);

  const toggle = (key: string, on?: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on ?? !next.has(key)) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-snug text-ink-muted">
        {anyProgress
          ? `Отметьте, что перенести в план «${planName}». Можно выбрать, как прибавлять, — выбор запомнится для упражнения.`
          : `На тренировке вы сделали не так, как в плане. Отметьте, что перенести в план «${planName}».`}
      </p>
      <ul className="flex flex-col">
        {changes.map((c) => {
          const on = checked.has(c.key);
          const p = c.progress;
          const picked = chosen.get(c.key) ?? 0;
          return (
            <li key={c.key} className="border-t border-line">
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-3">
                <input type="checkbox" checked={on} onChange={() => toggle(c.key)} className="h-6 w-6 shrink-0 accent-[var(--ink)]" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] leading-tight font-semibold">{c.exerciseName}</span>
                  <span className="text-[13px] text-ink-muted">{c.where}</span>
                </span>
                {(!p || p.choices.length === 1) && (
                  <span className="ml-auto shrink-0 text-right font-mono text-sm font-bold whitespace-nowrap">
                    {p ? (
                      c.to
                    ) : (
                      <>
                        <span className="text-ink-faint line-through">{c.from}</span> → {c.to}
                      </>
                    )}
                  </span>
                )}
              </label>
              {p && (
                <div className="flex flex-col gap-2 pb-3 pl-9">
                  {p.choices.length > 1 && (
                    <div role="radiogroup" aria-label={`Как прибавить: ${c.exerciseName}`} className={`grid gap-2 ${p.choices.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {p.choices.map((choice, i) => {
                        const sel = i === picked;
                        return (
                          <button
                            key={choice.kind}
                            type="button"
                            role="radio"
                            aria-checked={sel}
                            onClick={() => {
                              setChosen((prev) => new Map(prev).set(c.key, i));
                              toggle(c.key, true);
                            }}
                            className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl px-2 py-1.5 text-left transition-colors ${
                              sel ? "border-2 border-selected bg-selected text-on-selected" : "border-[1.5px] border-line-strong bg-transparent text-ink"
                            }`}
                          >
                            <span className="text-sm leading-tight font-bold">{choice.label}</span>
                            <span className="font-mono text-xs leading-tight">{choice.detail}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {p.setting && (
                    <span className="text-xs text-ink-muted">
                      {p.setting.text} ·{" "}
                      <button
                        type="button"
                        onClick={() =>
                          setSetting({
                            exerciseId: p.exerciseId,
                            exerciseName: c.exerciseName,
                            kind: p.setting!.kind,
                            value: p.setting!.value,
                            weighted: p.choices.some((x) => isWeight(x.kind)),
                          })
                        }
                        className="min-h-11 text-ink underline"
                      >
                        изменить
                      </button>
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => onDecide(changes.filter((c) => checked.has(c.key)).map((c) => (c.progress ? choose(c, chosen.get(c.key) ?? 0) : c)))}
          disabled={busy || count === 0}
        >
          {count ? `Обновить отмеченные (${count})` : "Обновить отмеченные"}
        </Button>
        <Button variant="outline" onClick={() => onDecide([])} disabled={busy}>
          Не обновлять
        </Button>
      </div>
      <ProgressSettingSheet
        target={setting}
        onClose={() => setSetting(null)}
        onSaved={() => {
          setSetting(null);
          // The choices of that exercise's lines are new: back to the first one.
          setChosen((prev) => new Map([...prev].filter(([k]) => !changes.find((c) => c.key === k && c.progress?.exerciseId === setting?.exerciseId))));
          onSettingSaved?.();
        }}
      />
    </div>
  );
}
