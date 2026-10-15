"use client";

import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { useLive } from "@/db/hooks";
import { workoutsRepo } from "@/db/repos/workouts";
import { bestResult, chartSeries, formatAxis, formatDelta, formatValue, inPeriod, PERIOD_LABELS, type Period } from "@/domain/chart-series";
import { formatShortDate } from "@/domain/format";
import { formatSetsSummary } from "@/domain/sets";
import type { Exercise } from "@/domain/types";

const PERIODS: Period[] = ["1m", "3m", "all"];
const DELTA_SUFFIX: Record<Period, string> = { "1m": "за месяц", "3m": "за 3 мес", all: "за всё время" };

function dayMonth(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Best result, progress chart with 1 мес / 3 мес / всё, and the set history (PRD §3.8–3.9). */
export function ExerciseProgress({ exercise }: { exercise: Exercise }) {
  const logType = exercise.log_type;
  const { data: sessions } = useLive(
    () => workoutsRepo.exerciseSessions([exercise.id]),
    [exercise.id],
    ["workouts", "workout_exercises", "workout_sets"],
  );
  const [period, setPeriod] = useState<Period>("all");

  if (!sessions) return null;
  const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";

  if (sessions.length === 0) {
    return (
      <section className="mt-6 flex flex-col gap-2 px-4">
        <h2 className={sectionTitle}>История подходов</h2>
        <p className="text-[15px] text-ink-muted">Пока не выполнялось. График появится после первой тренировки с этим упражнением.</p>
      </section>
    );
  }

  const all = chartSeries(logType, sessions);
  const points = inPeriod(all, period);
  const best = bestResult(logType, all);
  const delta = formatDelta(logType, points);
  const values = points.map((p) => p.value);

  return (
    <>
      <section className="mx-4 mt-5 flex flex-col gap-3 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
        {best ? (
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-on-inverse-muted">{best.title}</span>
              <span className="font-display text-[30px] leading-none font-extrabold text-accent">
                {best.value}
                {best.note && <span className="ml-1.5 text-base text-on-inverse">{best.note}</span>}
              </span>
            </div>
            {delta && (
              <span className="text-right font-mono text-[13px] text-on-inverse-muted">
                {delta} {delta !== "без изменений" && DELTA_SUFFIX[period]}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[15px] text-on-inverse-muted">Нет выполненных подходов — графику не из чего строиться.</span>
        )}

        {points.length > 0 ? (
          <LineChart
            points={points.map((p) => ({ t: new Date(p.date).getTime(), y: p.value, label: p.label, xLabel: dayMonth(p.date) }))}
            formatY={(v) => formatAxis(logType, v)}
            ariaLabel={`График по датам: от ${formatValue(logType, Math.min(...values))} до ${formatValue(logType, Math.max(...values))}`}
          />
        ) : (
          best && <p className="py-6 text-center text-[13px] text-on-inverse-muted">За этот период тренировок с этим упражнением нет.</p>
        )}

        <div role="radiogroup" aria-label="Период" className="grid grid-cols-3 gap-1.5">
          {PERIODS.map((p) => {
            const on = p === period;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPeriod(p)}
                className={`h-9 rounded-[9px] border-[1.5px] border-line-inverse text-[13px] font-semibold ${
                  on ? "bg-on-inverse text-surface-inverse" : "text-on-inverse-muted"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-2 px-4">
        <h2 className={sectionTitle}>История подходов</h2>
        {sessions.map((s) => {
          const done = s.sets.filter((x) => x.done_at);
          return (
            <Link
              key={s.workoutId}
              href={`/history/view/?id=${s.workoutId}`}
              className="flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-3"
            >
              <span className="shrink-0 text-sm text-ink-muted">{formatShortDate(s.startedAt)}</span>
              <span className={`text-right font-mono text-sm font-bold ${done.length ? "" : "text-ink-muted"}`}>
                {done.length ? formatSetsSummary(logType, done) : "не выполнено"}
              </span>
            </Link>
          );
        })}
      </section>
    </>
  );
}
