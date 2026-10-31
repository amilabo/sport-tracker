"use client";

import Link from "next/link";
import { useState } from "react";
import { DatePickSheet } from "@/components/body/DatePickSheet";
import { HeightSheet } from "@/components/body/HeightSheet";
import { MeasurementSheet } from "@/components/body/MeasurementSheet";
import { dayLabel, Delta, fullDate, periodPoints, sectionTitle, Sparkline, useBodyData } from "@/components/body/parts";
import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { workoutsRepo } from "@/db/repos/workouts";
import { trainingInPeriod, trendRate, weightTrend } from "@/domain/analytics/body-trend";
import { shortDate, type BodySession } from "@/domain/body";
import {
  BODY_PERIODS,
  compareGroups,
  composition,
  enteredCount,
  periodDates,
  restoreBodyView,
  shiftPeriodDate,
  type BodyPeriod,
  type BodyView,
  type CompareRow,
  type PeriodDates,
} from "@/domain/body-compare";
import { formatNumber, plural } from "@/domain/format";
import type { LocalDate } from "@/domain/types";

const metricHref = (row: CompareRow) => `/body/metric/?type=${row.type.id}`;
const valuesNote = (n: number) => `${n} ${plural(n, ["значение", "значения", "значений"])}`;
// Columns of the table: name · sparkline · было · стало · разница. Fits 375 px without scrolling sideways.
const COLS = "grid-cols-[minmax(0,1fr)_44px_50px_54px_56px]";

/** «к 08.09» for the previous session, «с 16.06» for a longer stretch, «с 16.06 по 08.09» when «стало» is not the latest. */
function caption(dates: PeriodDates, latest: LocalDate, period: BodyPeriod) {
  if (!dates.a || !dates.b) return "";
  if (dates.b !== latest) return `с ${dayLabel(dates.a, latest)} по ${dayLabel(dates.b, latest)}`;
  return `${period === "last" ? "к" : "с"} ${dayLabel(dates.a, latest)}`;
}

/** A value with a small date under it when the type's nearest value is not on the column's date. */
function Cell({ point, column, latest, strong }: { point: CompareRow["a"]; column: LocalDate | null; latest: LocalDate | null; strong?: boolean }) {
  if (!point) return <span className="text-right font-mono text-sm text-ink-muted">—</span>;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span
        className={`font-mono ${strong ? "text-[15px] font-bold" : "text-sm"} ${point.computed || !strong ? "text-ink-muted" : ""}`}
      >
        {formatNumber(point.value)}
      </span>
      {point.date !== column && <span className="font-mono text-[11px] text-ink-muted">{dayLabel(point.date, latest)}</span>}
    </span>
  );
}

interface DateStepperProps {
  label: string;
  date: LocalDate | null;
  latest: LocalDate | null;
  strong: boolean;
  onPick: () => void;
  prev: LocalDate | null;
  next: LocalDate | null;
  onStep: (date: LocalDate) => void;
}

/** «Было» / «Стало» of «Даты»: ‹ › step to the neighbouring measurement, a tap on the date opens the list (stage 31). */
function DateStepper({ label, date, latest, strong, onPick, prev, next, onStep }: DateStepperProps) {
  const arrow = "flex h-11 w-10 shrink-0 items-center justify-center rounded-[10px] disabled:opacity-30";
  return (
    <div className={`flex flex-col rounded-[14px] border-[1.5px] px-0.5 pt-1.5 pb-0.5 ${strong ? "border-ink bg-surface-raised" : "border-line-strong bg-surface"}`}>
      <span className="text-center text-xs text-ink-muted">{label}</span>
      <div className="flex items-center">
        <button type="button" onClick={() => prev && onStep(prev)} disabled={!prev} aria-label={`${label}: замер раньше`} className={arrow}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onPick}
          aria-label={`${label}: ${date ? fullDate(date) : "не выбрано"}, выбрать дату`}
          className="flex h-11 min-w-0 flex-1 items-center justify-center font-mono text-[15px] font-bold whitespace-nowrap"
        >
          {date ? dayLabel(date, latest) : "—"}
        </button>
        <button type="button" onClick={() => next && onStep(next)} disabled={!next} aria-label={`${label}: замер позже`} className={arrow}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function BodyPage() {
  const data = useBodyData();
  // «Тренировки и тело» (stage 43): the workouts of the period on screen.
  const { data: training } = useLive(() => workoutsRepo.completedItems(), [], ["workouts", "workout_exercises", "workout_sets", "exercises"]);
  // The switch is saved in settings (and so in a backup); this keeps the screen instant until the write lands.
  const [view, setView] = useState<BodyView | null>(null);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [editing, setEditing] = useState<BodySession | "new" | null>(null);
  const [heightOpen, setHeightOpen] = useState(false);

  const addButton = (
    <Button variant="accent" className="whitespace-nowrap" onClick={() => setEditing("new")}>
      + Замер
    </Button>
  );
  if (!data) return <PageHeader title="Тело" action={addButton} />;
  const { types, sessions, height } = data;
  const latest = sessions[0]?.date ?? null;
  const current = view ?? { period: data.bodyPeriod, custom: data.bodyCustom };
  const { period, custom } = restoreBodyView(sessions, current.period, current.custom);

  // «Даты» starts from the pair the screen showed last, so switching to it changes nothing at first.
  const shown = periodDates(sessions, period === "custom" ? "last" : period);
  const dates = period === "custom" ? periodDates(sessions, "custom", custom ?? shown) : shown;
  const groups = compareGroups(types, sessions, height, dates);
  const rows = groups.flatMap((g) => g.rows);
  const weight = rows.find((r) => r.type.key === "weight");
  const bmi = rows.find((r) => r.type.key === "bmi");
  const bmiType = types.find((t) => t.key === "bmi");
  const comp = composition(types, sessions, dates);
  const weightPoints = weight?.b ? periodPoints(weight.series, weight.a?.date ?? null, weight.b.date) : [];
  const cap = latest ? caption(dates, latest, period) : "";
  const compared = sessions.length > 1;
  // Weight trend (А4): smoothed over every entry, drawn over the period's dots.
  const trend = weight ? weightTrend(weight.series) : [];
  const rate = trendRate(trend);
  const shownTrend =
    rate && weightPoints.length > 1 ? trend.filter((p) => p.date >= weightPoints[0].date && p.date <= weightPoints.at(-1)!.date).map((p) => ({ t: new Date(`${p.date}T12:00:00`).getTime(), y: p.value })) : null;
  const inPeriod = training && dates.a && dates.b ? trainingInPeriod(training.workouts, training.items, dates.a, dates.b) : null;
  const bodyRows = dates.a ? rows.filter((r) => r.a && r.b && r.a.date !== r.b.date && (r.type.unit === "кг" || r.type.unit === "см")) : [];
  const periodText = period === "last" ? "между замерами" : period === "3m" ? "за 3 мес" : period === "all" ? "с начала" : dates.a && dates.b ? `${dayLabel(dates.a, latest)} – ${dayLabel(dates.b, latest)}` : "";

  function saveView(next: BodyView) {
    setView(next);
    settingsRepo.update({ body_period: next.period, body_custom: next.custom }).catch(console.error);
  }

  function choosePeriod(p: BodyPeriod) {
    saveView({ period: p, custom: p === "custom" && period !== "custom" ? dates : custom });
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5 pb-6">
      <div className="flex flex-col gap-1.5">
        <PageHeader title="Тело" action={addButton} />
        {latest && <p className="px-5 text-sm text-ink-muted">Последний замер {shortDate(latest)}</p>}
      </div>

      {sessions.length === 0 && (
        <section className="mx-4 flex flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4">
          <span className="text-[15px] font-semibold">Замеров пока нет</span>
          <span className="text-[13px] leading-snug text-ink-muted">
            «+ Замер» — дата и значения: вес, жир, мышцы, талия, бёдра и другие. Пустые поля не сохраняются. ИМТ и проценты посчитаются сами.
          </span>
        </section>
      )}

      {compared && (
        <div className="flex flex-col gap-2 px-4">
          <div role="radiogroup" aria-label="С чем сравнивать" className="grid grid-cols-4 gap-1 rounded-[13px] bg-surface-done p-[3px]">
            {BODY_PERIODS.map((p) => {
              const on = p.id === period;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choosePeriod(p.id)}
                  className={`h-11 rounded-[10px] px-0.5 text-sm font-semibold whitespace-nowrap transition-colors ${on ? "bg-surface-raised text-ink" : "text-ink-muted"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {period === "custom" && dates.b && (
            <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-1.5">
              {(["a", "b"] as const).map((side, i) => (
                <div key={side} className="contents">
                  {i === 1 && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                  <DateStepper
                    label={side === "a" ? "Было" : "Стало"}
                    date={dates[side]}
                    latest={latest}
                    strong={side === "b"}
                    onPick={() => setPicking(side)}
                    prev={shiftPeriodDate(sessions, dates, side, -1)}
                    next={shiftPeriodDate(sessions, dates, side, 1)}
                    onStep={(date) => saveView({ period, custom: { ...dates, [side]: date } })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {weight?.b && (
        <section className="mx-4 flex flex-col gap-3.5 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
          <Link href={metricHref(weight)} className="flex items-start justify-between gap-3">
            <span className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-on-inverse-muted">{weight.b.date === dates.b ? "Вес" : `Вес на ${dayLabel(weight.b.date, latest)}`}</span>
              <span className="font-display text-[44px] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap">
                {formatNumber(weight.b.value)}
                <span className="ml-1 font-sans text-[17px] font-semibold tracking-normal">кг</span>
              </span>
              {weight.delta !== null && (
                <span className="flex items-center gap-1.5 text-[13px] text-on-inverse-muted">
                  <Delta value={weight.delta} unit="кг" size={14} className="text-on-inverse" />
                  <span className="font-mono text-sm font-bold text-on-inverse">кг</span>
                  {cap}
                </span>
              )}
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-on-inverse-muted">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
          {weightPoints.length > 1 && (
            <LineChart
              key={`${weightPoints[0].date}-${weightPoints.at(-1)!.date}`}
              points={weightPoints.map((p) => ({
                t: new Date(`${p.date}T12:00:00`).getTime(),
                y: p.value,
                xLabel: dayLabel(p.date, latest),
                detail: `${fullDate(p.date)} · ${formatNumber(p.value)} кг`,
              }))}
              formatY={(v) => formatNumber(Math.round(v * 10) / 10)}
              ariaLabel={`Вес с ${dayLabel(weightPoints[0].date, latest)} по ${dayLabel(weightPoints.at(-1)!.date, latest)}: от ${formatNumber(weightPoints[0].value)} до ${formatNumber(weightPoints.at(-1)!.value)} кг${
                shownTrend ? `, тренд от ${formatNumber(shownTrend[0].y)} до ${formatNumber(shownTrend.at(-1)!.y)} кг` : ""
              }`}
              trend={shownTrend}
            />
          )}
          {rate && (
            <div className="flex flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex h-[30px] items-center gap-1.5 rounded-[10px] border border-line-inverse px-2.5 font-mono text-[13px] font-bold">
                  {Math.abs(rate.perWeek) < 0.05 ? (
                    "≈ без изменений"
                  ) : (
                    <>
                      <span className="text-accent-on-inverse">{rate.perWeek < 0 ? "↓" : "↑"}</span>
                      {formatNumber(Math.abs(rate.perWeek))} кг в неделю
                    </>
                  )}
                </span>
                <span className="text-[13px] text-on-inverse-muted">
                  тренд за {rate.weeks} {plural(rate.weeks, ["неделю", "недели", "недель"])}
                </span>
              </span>
              {shownTrend && (
                <span aria-hidden="true" className="flex gap-4 text-xs text-on-inverse-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[9px] w-[9px] rounded-full border-2 border-on-inverse-muted" />
                    замеры
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-[3px] w-4 rounded-sm bg-chart-line" />
                    тренд — без скачков воды и еды
                  </span>
                </span>
              )}
            </div>
          )}
          <div className="flex min-h-11 items-center justify-between gap-2 border-t border-line-inverse pt-3 text-sm">
            {bmi?.b ? (
              <Link href={metricHref(bmi)} className="flex min-h-11 flex-1 items-center justify-between gap-2">
                <span className="text-on-inverse-muted">
                  ИМТ <b className="ml-1 font-mono text-on-inverse">{formatNumber(bmi.b.value)}</b>
                  <span className="ml-1.5">· рост {height} см</span>
                </span>
                {bmi.delta !== null && <Delta value={bmi.delta} className="text-on-inverse-muted" />}
              </Link>
            ) : (
              bmiType && (
                <button type="button" onClick={() => setHeightOpen(true)} className="min-h-11 font-semibold text-on-inverse underline underline-offset-2">
                  Указать рост для ИМТ
                </button>
              )
            )}
          </div>
        </section>
      )}

      {comp && (
        <section className="mx-4 flex flex-col gap-3.5 rounded-[18px] border-[1.5px] border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className={sectionTitle}>Состав тела</h2>
            <span className="text-[13px] text-ink-muted">
              из {formatNumber(comp.weight)} кг{comp.date !== dates.b && ` · ${dayLabel(comp.date, latest)}`}
            </span>
          </div>
          <div aria-hidden="true" className="flex h-3.5 gap-[3px]">
            {comp.parts.map((p) => (
              <span
                key={p.key}
                style={{ width: `${p.pct}%` }}
                className={`rounded ${p.key === "fat" ? "bg-accent-line" : p.key === "muscle" ? "bg-ink" : "bg-line-strong"}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {comp.parts.map((p) => (
              <div key={p.key} className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${p.key === "fat" ? "bg-accent-line" : p.key === "muscle" ? "bg-ink" : "bg-line-strong"}`} />
                  {p.name}
                </span>
                <span className="text-lg font-bold whitespace-nowrap">
                  {formatNumber(p.kg)}
                  <span className="ml-0.5 text-[13px] font-semibold">кг</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs whitespace-nowrap text-ink-muted">
                  {formatNumber(p.pct)} %{p.delta !== null && <Delta value={p.delta} unit="кг" size={12} />}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length > 0 && (
        <section className="mx-4 flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
          <div className="flex items-baseline justify-between px-3.5 pt-3.5 pb-1">
            <h2 className={sectionTitle}>Все показатели</h2>
            <span className="text-xs text-ink-muted">тап — график</span>
          </div>
          <div className={`grid ${COLS} gap-1.5 px-3.5 pt-1.5 pb-2.5 text-xs text-ink-muted`} aria-hidden="true">
            <span />
            <span />
            <span className="text-right">{dates.a ? dayLabel(dates.a, latest) : ""}</span>
            <span className="text-right font-semibold text-ink">{dates.b ? dayLabel(dates.b, latest) : ""}</span>
            <span className="text-right">{compared ? "Разница" : ""}</span>
          </div>
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col">
              <h3 className="border-t border-line px-3.5 pt-3 pb-1.5 font-display text-[11px] font-bold tracking-[0.05em] text-ink-muted uppercase">{g.title}</h3>
              {g.rows.map((r) => (
                <Link
                  key={r.type.id}
                  href={metricHref(r)}
                  aria-label={`${r.type.name}${r.type.unit ? `, ${r.type.unit}` : ""}: ${r.b ? formatNumber(r.b.value) : "нет значения"}${
                    r.a ? `, было ${formatNumber(r.a.value)}` : ""
                  }. Открыть график`}
                  className={`grid min-h-11 ${COLS} items-center gap-1.5 px-3.5 py-1`}
                >
                  <span className="truncate text-sm font-medium">
                    {r.type.name}
                    {r.type.unit && <span className="ml-1 text-xs font-normal text-ink-muted">{r.type.unit}</span>}
                  </span>
                  <Sparkline series={r.series} from={r.a?.date ?? null} to={r.b?.date ?? null} width={44} height={20} />
                  <Cell point={r.a} column={dates.a} latest={latest} />
                  <Cell point={r.b} column={dates.b} latest={latest} strong />
                  <span className="flex justify-end">{r.a && <Delta value={r.delta} unit={r.type.unit} />}</span>
                </Link>
              ))}
            </div>
          ))}
          <p className="border-t border-line px-3.5 pt-2.5 pb-3 text-xs leading-snug text-ink-muted">
            Серым — посчитано: ИМТ по весу и росту{height ? ` (${height} см)` : ""}, проценты жира и мышц из килограммов, если их не ввели вручную. Маленькая дата —
            ближайший замер этого показателя.{" "}
            <button type="button" onClick={() => setHeightOpen(true)} className="font-semibold text-ink underline underline-offset-2">
              {height ? "Изменить рост" : "Указать рост"}
            </button>
          </p>
        </section>
      )}

      {dates.a && dates.b && (inPeriod || bodyRows.length > 0) && (
        <section aria-labelledby="per-h" className="mx-4 flex flex-col gap-3 rounded-[18px] border-[1.5px] border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="per-h" className={sectionTitle}>
              {inPeriod ? "Тренировки и тело" : "Тело за период"}
            </h2>
            <span className="text-[13px] text-ink-muted">{periodText}</span>
          </div>
          {inPeriod && (
            <dl className="grid grid-cols-3 gap-2">
              {[
                ["Тренировок", String(inPeriod.workouts)],
                ["В неделю", formatNumber(inPeriod.perWeek)],
                ["Подходов", String(inPeriod.sets)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-ink-muted">{k}</dt>
                  <dd className="font-mono text-lg font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {inPeriod && inPeriod.strength.length > 0 && (
            <div className="flex flex-col">
              <h3 className="pb-1 text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">Сила · ≈ максимум</h3>
              {inPeriod.strength.map((x) => (
                <div key={x.name} className="flex min-h-10 items-center gap-2 border-t border-line py-1.5">
                  <span className="flex-1 text-[15px]">{x.name}</span>
                  <span className="font-mono text-sm text-ink-muted">{formatNumber(x.from)} →</span>
                  <span className="font-mono text-sm font-bold">{formatNumber(x.to)} кг</span>
                </div>
              ))}
            </div>
          )}
          {bodyRows.length > 0 && (
            <div className="flex flex-col">
              <h3 className="pb-1 text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">Тело</h3>
              {bodyRows.map((r) => (
                <div key={r.type.id} className="flex min-h-10 items-center gap-2 border-t border-line py-1.5">
                  <span className="flex-1 text-[15px]">{r.type.name}</span>
                  <span className="font-mono text-sm text-ink-muted">{formatNumber(r.a!.value)} →</span>
                  <span className="font-mono text-sm font-bold">
                    {formatNumber(r.b!.value)} {r.type.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
          {inPeriod && inPeriod.strength.length > 0 && <p className="text-xs leading-[1.45] text-ink-muted">Сила — по трём упражнениям, которые вы делали чаще всего за этот период.</p>}
        </section>
      )}

      {sessions.length > 0 && (
        <section className="flex flex-col gap-2 px-4">
          <h2 className={`${sectionTitle} px-1 pt-1.5`}>Записи</h2>
          <div className="flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
            {sessions.slice(0, 3).map((s) => (
              <button
                key={s.date}
                type="button"
                onClick={() => setEditing(s)}
                aria-label={`Замер ${fullDate(s.date)}, ${valuesNote(enteredCount(s))}: изменить или удалить`}
                className="flex min-h-[52px] items-center gap-2.5 border-t border-line px-3.5 text-left first:border-t-0"
              >
                <span className="flex-1 font-mono text-sm font-bold">{fullDate(s.date)}</span>
                <span className="text-[13px] text-ink-muted">{valuesNote(enteredCount(s))}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
            {sessions.length > 3 && (
              <Link
                href="/body/records/"
                className="flex min-h-12 items-center border-t border-line px-3.5 text-sm font-semibold text-ink-muted underline underline-offset-[3px]"
              >
                Все {sessions.length} {plural(sessions.length, ["запись", "записи", "записей"])}
              </Link>
            )}
          </div>
        </section>
      )}

      <DatePickSheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === "a" ? "Было" : "Стало"}
        dates={sessions
          .filter((s) => (picking === "a" ? !dates.b || s.date < dates.b : !dates.a || s.date > dates.a))
          .map((s) => ({ date: s.date, note: valuesNote(enteredCount(s)) }))}
        selected={picking ? dates[picking] : null}
        onPick={(date) => picking && saveView({ period, custom: { ...dates, [picking]: date } })}
      />
      <MeasurementSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        types={types}
        sessions={sessions}
        session={editing === "new" ? null : editing}
        heightCm={height}
        onAskHeight={() => setHeightOpen(true)}
      />
      {heightOpen && <HeightSheet open onClose={() => setHeightOpen(false)} current={height} />}
    </div>
  );
}
