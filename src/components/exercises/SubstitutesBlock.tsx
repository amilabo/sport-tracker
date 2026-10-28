"use client";

import Link from "next/link";
import { useState } from "react";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { substituteContext } from "@/db/repos/substitutes";
import { plural } from "@/domain/format";
import { lastTimeText, markText, relationText, substituteSections } from "@/domain/substitutes";
import type { Exercise } from "@/domain/types";
import { ExercisePicker } from "./ExercisePicker";

/** Rows shown on the screen; the rest are in the gym sheet and in «Подобрать из всех». */
const SHOWN = 4;

function SwapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
    </svg>
  );
}

/**
 * «Чем заменить» on the exercise screen (stage 29, mockup 27): choose «Ваша замена» in advance — in the gym it is
 * first in «Заменить». Closed by default so the chart stays in view; closed, it shows yours or the first options.
 */
export function SubstitutesBlock({ exercise }: { exercise: Exercise }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const { data: ctx } = useLive(() => substituteContext(exercise.id), [exercise.id], ["exercises", "workouts", "workout_exercises"]);
  if (!ctx) return null;

  const s = substituteSections(ctx);
  const rows = s.similar.slice(0, SHOWN);
  const mine = s.mine;
  const total = s.similar.length;
  const hint = mine ? `Ваша замена: ${mine.exercise.name}` : rows.slice(0, 3).map((r) => r.exercise.name).join(", ");
  const choose = (id: string | null) => exercisesRepo.setSubstitute(exercise.id, id);

  return (
    <section aria-labelledby="subs-title" className="mx-4 mt-3 overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-start gap-3 px-3.5 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inverse text-on-inverse">
          <SwapIcon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
          <span className="flex items-baseline gap-2">
            <span id="subs-title" className="font-display text-xs font-bold tracking-[0.04em] uppercase">
              Чем заменить
            </span>
            {total > 0 && <span className="font-mono text-xs text-ink-muted">{`${total} ${plural(total, ["вариант", "варианта", "вариантов"])}`}</span>}
          </span>
          {!open && hint && <span className="line-clamp-2 text-[13px] leading-[1.4] text-ink-muted">{hint}</span>}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`mt-2 shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-3.5 pb-3.5">
          {mine ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-surface-inverse py-3 pr-3 pl-3.5 text-on-inverse">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-[11px] font-bold tracking-[0.06em] text-accent-on-inverse uppercase">Ваша замена</span>
                <Link href={`/exercises/view/?id=${mine.exercise.id}`} className="text-base leading-snug font-semibold">
                  {mine.exercise.name}
                </Link>
                {(relationText(mine) || lastTimeText(mine)) && (
                  <span className="text-[13px] text-on-inverse-muted">{relationText(mine) ?? lastTimeText(mine)}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => choose(null)}
                className="min-h-11 shrink-0 rounded-xl border-[1.5px] border-line-inverse px-3 text-sm font-semibold"
              >
                Убрать
              </button>
            </div>
          ) : (
            <p className="rounded-[14px] border-[1.5px] border-dashed border-line-strong px-3.5 py-3 text-sm leading-snug text-ink-muted">
              Выберите замену заранее — в зале она будет первой, когда нажмёте «Заменить».
            </p>
          )}

          {rows.length > 0 && (
            <ul className="flex flex-col">
              {rows.map((r) => {
                const line = relationText(r);
                const mark = markText(r);
                return (
                  <li key={r.exercise.id} className="flex items-center gap-2 border-t border-line py-2.5">
                    <Link href={`/exercises/view/?id=${r.exercise.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] leading-snug font-semibold">{r.exercise.name}</span>
                      {line && <span className="text-[13px] text-ink-muted">{line}</span>}
                      {mark && <span className="font-mono text-xs text-ink-muted">{mark}</span>}
                    </Link>
                    <button
                      type="button"
                      onClick={() => choose(r.exercise.id)}
                      aria-label={`Сделать заменой: ${r.exercise.name}`}
                      className="min-h-11 min-w-[88px] shrink-0 rounded-xl border-[1.5px] border-ink px-3 text-sm font-semibold transition-transform active:scale-[0.98]"
                    >
                      Выбрать
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className="min-h-12 rounded-[14px] border-[1.5px] border-dashed border-ink px-3 text-[15px] font-semibold"
          >
            Подобрать из всех упражнений
          </button>
        </div>
      )}

      <ExercisePicker
        open={picking}
        title="Ваша замена"
        pickLabel="Сделать заменой"
        disabledIds={[exercise.id]}
        onClose={() => setPicking(false)}
        onPick={async (e) => {
          setPicking(false);
          await choose(e.id);
        }}
      />
    </section>
  );
}
