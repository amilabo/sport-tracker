"use client";

import Link from "next/link";
import { useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useLive } from "@/db/hooks";
import { progressionsRepo } from "@/db/repos/progressions";
import { workoutsRepo } from "@/db/repos/workouts";
import { bestE1rm } from "@/domain/analytics/e1rm";
import { exerciseRecords } from "@/domain/analytics/records";
import { stall, stallOptions, stallTitle, type Stall } from "@/domain/analytics/stall";
import { E1RM_MAX_REPS } from "@/domain/analytics/thresholds";
import { bestResult, chartSeries, formatAxis, formatDelta, formatValue, inPeriod, PERIOD_LABELS, type ChartMetric, type ExerciseSession, type Period } from "@/domain/chart-series";
import { formatNumber, formatShortDate } from "@/domain/format";
import { formatSetsSummary } from "@/domain/sets";
import type { Exercise, Plan } from "@/domain/types";

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

/** «С 30.09 расчётный максимум ≈ 30 кг» — what the level is. */
function levelText(logType: Exercise["log_type"], plateau: Stall, onE1rm: boolean): string {
  if (onE1rm) return `расчётный максимум ≈ ${formatNumber(plateau.value, 2)} кг`;
  if (logType === "weight_reps") return `лучший вес ${formatValue(logType, plateau.value)}`;
  if (logType === "time") return `самый долгий подход ${formatValue(logType, plateau.value)}`;
  return `лучший результат ${formatValue(logType, plateau.value)}`;
}

/** А1: «4 тренировки на одном уровне» and what to try next time. */
function StallCard(props: { exercise: Exercise; plateau: Stall; onE1rm: boolean; sessions: ExerciseSession[]; harder: string | null; plan: Plan | null }) {
  const { exercise, plateau } = props;
  const options = stallOptions(exercise, props.sessions, props.harder);
  return (
    <section aria-labelledby="stall-h" className="mx-4 mt-3.5 flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inverse text-accent-on-inverse">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l6-6 4 4 4-4h4" />
          </svg>
        </span>
        <h2 id="stall-h" className="text-base leading-tight font-bold">
          {stallTitle(plateau.count)}
        </h2>
      </div>
      <p className="text-sm leading-[1.45] text-ink-muted">
        С {dayMonth(plateau.since)} {levelText(exercise.log_type, plateau, props.onE1rm)}.{options.length > 0 && " Что можно попробовать в следующий раз:"}
      </p>
      {options.length > 0 && (
        <ul className="flex flex-col">
          {options.map((o) => (
            <li key={o.label} className="flex min-h-11 items-center gap-2.5 border-t border-line">
              <span className="flex-1 text-[15px]">{o.label}</span>
              <span className={o.muted ? "text-right text-sm text-ink-muted" : "font-mono text-sm font-bold"}>{o.value}</span>
            </li>
          ))}
        </ul>
      )}
      {props.plan && (
        <ButtonLink href={`/plans/edit/?id=${props.plan.id}`} variant="outline" size="md" className="w-full">
          Изменить в плане «{props.plan.name}»
        </ButtonLink>
      )}
    </section>
  );
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
  // For «4 тренировки на одном уровне» (stage 41): the next level of the progression, the plan to change.
  const { data: context } = useLive(
    async () => {
      const chain = exercise.progression_id ? await progressionsRepo.chainOf(exercise.id) : null;
      const i = chain ? chain.members.findIndex((m) => m.id === exercise.id) : -1;
      const harder = chain && i >= 0 ? (chain.members[i + 1] ?? null) : null;
      const ids = (await workoutsRepo.exerciseSessions([exercise.id])).map((s) => s.workoutId);
      return { harder: harder?.name ?? null, plan: await workoutsRepo.latestPlanOf(ids) };
    },
    [exercise.id, exercise.progression_id],
    ["exercises", "progressions", "plans", "workouts"],
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
  // The level: ≈ максимум when there is one, otherwise the usual chart value. Cardio has no level.
  const levelOnE1rm = canE1rm;
  const plateau = logType === "cardio" ? null : stall(levelOnE1rm ? e1rmAll : chartSeries(logType, sessions));
  const bandShown = plateau && (shown === "e1rm") === levelOnE1rm;

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
              detail: `${fullDate(p.date)} · ${shown === "e1rm" ? "≈ " : ""}${formatValue(logType, p.value)}${p.label ? ` ${p.label}` : ""}${p.note ? ` ${p.note}` : ""}`,
            }))}
            formatY={(v) => formatAxis(logType, v)}
            band={bandShown ? { fromT: new Date(plateau.since).getTime(), label: `${plateau.count} на одном уровне` } : null}
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

      {plateau && (
        <StallCard
          exercise={exercise}
          plateau={plateau}
          onE1rm={levelOnE1rm}
          sessions={sessions.filter((s) => s.startedAt >= plateau.since)}
          harder={context?.harder ?? null}
          plan={context?.plan ?? null}
        />
      )}

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
