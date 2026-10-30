"use client";

import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { useLive } from "@/db/hooks";
import { workoutsRepo } from "@/db/repos/workouts";
import { bestE1rm } from "@/domain/analytics/e1rm";
import { exerciseRecords } from "@/domain/analytics/records";
import { E1RM_MAX_REPS } from "@/domain/analytics/thresholds";
import { bestResult, chartSeries, formatAxis, formatDelta, formatValue, inPeriod, PERIOD_LABELS, type ChartMetric, type ExerciseSession, type Period } from "@/domain/chart-series";
import { formatNumber, formatShortDate } from "@/domain/format";
import { formatSetsSummary } from "@/domain/sets";
import type { Exercise } from "@/domain/types";

const PERIODS: Period[] = ["1m", "3m", "all"];
/** The history can be long: the latest few, the rest on demand. */
const HISTORY_PREVIEW = 5;
const DELTA_SUFFIX: Record<Period, string> = { "1m": "за месяц", "3m": "за 3 мес", all: "за всё время" };

function dayMonth(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** «07.10.2026» for the tap callout. */
function fullDate(iso: string) {
  return `${dayMonth(iso)}.${new Date(iso).getFullYear()}`;
}

/** The all-time ≈ максимум for the card head: «≈ 30 кг», «по лучшему подходу 22,5 кг × 10». */
function e1rmBest(sessions: ExerciseSession[]): { title: string; value: string; note: string | null; under: string } | null {
  const best = bestE1rm(sessions.flatMap((s) => s.sets));
  if (!best) return null;
  return {
    title: "Расчётный максимум на 1 повтор",
    value: `≈ ${formatNumber(best.value, 2)} кг`,
    note: null,
    under: `по лучшему подходу ${formatNumber(best.set.weight!, 2)} кг × ${best.set.reps}`,
  };
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
  const [metric, setMetric] = useState<ChartMetric>("best");
  const [showAll, setShowAll] = useState(false);

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

  // «≈ Максимум» (stage 40, А1): «вес × раз» with at least one set of 1…12 reps; otherwise «Лучший вес» only.
  const e1rmAll = logType === "weight_reps" ? chartSeries(logType, sessions, "e1rm") : [];
  const canE1rm = e1rmAll.length > 0;
  const shown: ChartMetric = canE1rm ? metric : "best";
  const all = shown === "e1rm" ? e1rmAll : chartSeries(logType, sessions);
  const points = inPeriod(all, period);
  const best: { title: string; value: string; note: string | null; under?: string } | null = shown === "e1rm" ? e1rmBest(sessions) : bestResult(logType, all);
  const delta = formatDelta(logType, points);
  const values = points.map((p) => p.value);
  const records = exerciseRecords(logType, sessions);

  return (
    <>
      <section className="mx-4 mt-5 flex flex-col gap-3 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
        {canE1rm && (
          <div role="radiogroup" aria-label="Что показывать" className="grid grid-cols-2 gap-1 rounded-[13px] border-[1.5px] border-line-inverse p-[3px]">
            {(["best", "e1rm"] as const).map((m) => {
              const on = m === shown;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMetric(m)}
                  className={`h-10 rounded-[9px] text-sm ${on ? "bg-on-inverse font-bold text-surface-inverse" : "font-semibold text-on-inverse-muted"}`}
                >
                  {m === "best" ? "Лучший вес" : "≈ Максимум"}
                </button>
              );
            })}
          </div>
        )}
        {best ? (
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-on-inverse-muted">{best.title}</span>
              <span className="font-display text-[30px] leading-none font-extrabold text-accent-on-inverse">
                {best.value}
                {best.note && <span className="ml-1.5 text-base text-on-inverse">{best.note}</span>}
              </span>
              {best.under && <span className="text-[13px] text-on-inverse-muted">{best.under}</span>}
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
            key={period}
            points={points.map((p) => ({
              t: new Date(p.date).getTime(),
              y: p.value,
              label: p.label,
              xLabel: dayMonth(p.date),
              detail: `${fullDate(p.date)} · ${formatValue(logType, p.value)}${p.label ? ` ${p.label}` : ""}`,
            }))}
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
                className={`h-11 rounded-[9px] border-[1.5px] border-line-inverse text-[13px] font-semibold ${
                  on ? "bg-on-inverse text-surface-inverse" : "text-on-inverse-muted"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
        </div>
      </section>

      {records.length > 0 && (
        <section aria-labelledby="records-h" className="mx-4 mt-5 flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface px-4 pt-3.5 pb-3">
          <h2 id="records-h" className={`${sectionTitle} mb-1.5`}>
            Рекорды
          </h2>
          <dl className="flex flex-col">
            {records.map((r) => (
              <div key={r.title} className="flex min-h-10 items-baseline gap-2.5 border-t border-line pt-2 pb-1">
                <dt className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px]">{r.title}</span>
                  <span className="text-xs text-ink-muted">
                    {dayMonth(r.date)}
                    {r.note && ` · ${r.note}`}
                  </span>
                </dt>
                <dd className="font-mono text-[15px] font-bold">{r.value}</dd>
              </div>
            ))}
          </dl>
          {logType === "weight_reps" && (
            <p className="mt-2 text-xs leading-[1.45] text-ink-muted">
              ≈ — оценка по формуле: вес × (1 + повторы / 30). Считается по подходам до {E1RM_MAX_REPS} повторов; если все подходы длиннее — только «Лучший вес».
            </p>
          )}
        </section>
      )}

      <section className="mt-5 flex flex-col gap-2 px-4">
        <h2 className={sectionTitle}>История подходов</h2>
        {(showAll ? sessions : sessions.slice(0, HISTORY_PREVIEW)).map((s) => {
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
        {sessions.length > HISTORY_PREVIEW && (
          <Button variant="quiet" className="w-full" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Свернуть" : `Показать все (${sessions.length})`}
          </Button>
        )}
      </section>
    </>
  );
}
