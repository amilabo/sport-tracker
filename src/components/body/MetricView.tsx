"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { HistoryStrip } from "@/components/charts/HistoryStrip";
import { LineChart } from "@/components/charts/LineChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { shortDate, valueOf, type BodySession } from "@/domain/body";
import { compareType, periodDates, type BodyPeriod } from "@/domain/body-compare";
import { moveEdge, presetWindow, stepEdge, windowOf, type ChartWindow } from "@/domain/chart-window";
import { formatNumber } from "@/domain/format";
import type { LocalDate } from "@/domain/types";
import { HeightSheet } from "./HeightSheet";
import { MeasurementSheet } from "./MeasurementSheet";
import { dayLabel, Delta, fullDate, sectionTitle, useBodyData } from "./parts";

type Span = "3m" | "1y" | "all";
const SPANS: { id: Span; label: string; months: number | null }[] = [
  { id: "3m", label: "3 мес", months: 3 },
  { id: "1y", label: "Год", months: 12 },
  { id: "all", label: "Всё", months: null },
];

/** «С ‹ 13.07 ›» on the dark card: moves one edge of the chart's window by one measurement. */
function EdgeStepper({ label, date, onPrev, onNext, name }: { label: string; date: string; onPrev: (() => void) | null; onNext: (() => void) | null; name: string }) {
  const arrow = "flex h-11 w-10 shrink-0 items-center justify-center rounded-[10px] disabled:opacity-30";
  return (
    <div className="flex items-center rounded-[14px] border-[1.5px] border-line-inverse pl-3">
      <span className="text-xs text-on-inverse-muted">{label}</span>
      <button type="button" onClick={onPrev ?? undefined} disabled={!onPrev} aria-label={`${name}: замер раньше`} className={`${arrow} ml-auto`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <span className="font-mono text-[15px] font-bold whitespace-nowrap">{date}</span>
      <button type="button" onClick={onNext ?? undefined} disabled={!onNext} aria-label={`${name}: замер позже`} className={arrow}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

/**
 * One measurement type (PRD §3.10, mockup 7Г): totals, chart and every value by date.
 * Stage 31 (mockup 31): the chart shows a window of the history — «3 мес / Год / Всё», ‹ › on its edges, or dragging on the strip.
 */
export function MetricView() {
  const id = useSearchParams().get("type");
  const data = useBodyData();
  // The window as dates of its edges, so a new measurement does not shift it; per type.
  const [win, setWin] = useState<{ type: string; from: LocalDate; to: LocalDate } | null>(null);
  const [editing, setEditing] = useState<BodySession | null>(null);
  const [heightOpen, setHeightOpen] = useState(false);

  if (!data) return <PageHeader title="Замер" backHref="/body/" />;
  const { types, sessions, height } = data;
  const type = types.find((t) => t.id === id);
  if (!type) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Замер" backHref="/body/" />
        <p className="px-5 text-[15px] text-ink-muted">Такого замера нет — возможно, его удалили.</p>
      </div>
    );
  }

  const unit = type.unit ? ` ${type.unit}` : "";
  const totals = (["last", "3m", "all"] as BodyPeriod[]).map((p) => ({ p, row: compareType(type, sessions, types, height, periodDates(sessions, p)) }));
  const series = totals[0].row.series;
  const last = series.at(-1) ?? null;
  const label = (p: BodyPeriod, a: string | undefined) => (p === "3m" ? "за 3 мес." : a ? `${p === "last" ? "к" : "с"} ${dayLabel(a, last?.date ?? null)}` : p === "last" ? "к прошлому" : "с начала");

  const dates = series.map((p) => p.date);
  const w = win && win.type === type.id ? windowOf(dates, win.from, win.to) : presetWindow(dates, null);
  const shown = series.slice(w.a, w.b + 1);
  const values = shown.map((p) => p.value);
  const setWindow = (next: ChartWindow | null) => next && setWin({ type: type.id, from: dates[next.a], to: dates[next.b] });
  // Equal windows (a short history): the widest one is marked.
  const span = [...SPANS].reverse().find((s) => {
    const p = presetWindow(dates, s.months);
    return p.a === w.a && p.b === w.b;
  })?.id;
  const day = (i: number) => dayLabel(dates[i], last?.date ?? null);

  // Newest first, each with the change against the type's previous value.
  const history = [...series].reverse().map((p, i, list) => {
    const prev = list[i + 1];
    const session = sessions.find((s) => s.date === p.date)!;
    return { ...p, session, computed: valueOf(type, session, types, height)?.computed ?? false, delta: prev ? Math.round((p.value - prev.value) * 10) / 10 : null };
  });

  return (
    <div className="flex flex-1 flex-col gap-3.5 pb-8">
      <PageHeader title={`${type.name}${type.unit ? `, ${type.unit}` : ""}`} backHref="/body/" />

      {!last ? (
        <section className="mx-4 flex flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4 text-[15px]">
          {type.computed === "bmi" && !height ? (
            <>
              <span>ИМТ считается по весу и росту.</span>
              <button type="button" onClick={() => setHeightOpen(true)} className="min-h-11 self-start font-semibold underline underline-offset-2">
                Указать рост
              </button>
            </>
          ) : (
            <span className="text-ink-muted">Этот замер ещё не вводили.</span>
          )}
        </section>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 px-5">
            <span className="font-display text-[44px] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap">
              {formatNumber(last.value)}
              {type.unit && <span className="ml-1.5 font-sans text-base font-semibold tracking-normal text-ink-muted">{type.unit}</span>}
            </span>
            <span className="pb-1 text-[13px] text-ink-muted">последний — {fullDate(last.date)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4">
            {totals.map(({ p, row }) => (
              <div key={p} className="flex flex-col gap-1 rounded-[14px] border-[1.5px] border-line bg-surface px-3 py-2.5">
                <span className="text-xs text-ink-muted">{label(p, row.a?.date)}</span>
                <Delta value={row.delta} unit={type.unit} size={16} />
              </div>
            ))}
          </div>

          <section className="mx-4 flex flex-col gap-2.5 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-on-inverse-muted">
                {values.length > 1 ? `мин ${formatNumber(Math.min(...values))} · макс ${formatNumber(Math.max(...values))}` : ""}
              </span>
              <span role="radiogroup" aria-label="Период графика" className="flex gap-1">
                {SPANS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={span === s.id}
                    onClick={() => setWindow(presetWindow(dates, s.months))}
                    className={`h-11 min-w-12 rounded-[10px] border-[1.5px] border-line-inverse px-2.5 text-[13px] font-semibold ${
                      span === s.id ? "bg-on-inverse text-surface-inverse" : "text-on-inverse-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </span>
            </div>
            <LineChart
              key={`${type.id}-${w.a}-${w.b}`}
              points={shown.map((p) => ({
                t: new Date(`${p.date}T12:00:00`).getTime(),
                y: p.value,
                xLabel: shortDate(p.date),
                detail: `${fullDate(p.date)} · ${formatNumber(p.value)}${unit}`,
              }))}
              formatY={(v) => formatNumber(v)}
              ariaLabel={`График: ${type.name} с ${day(w.a)} по ${day(w.b)}`}
            />
            {series.length > 1 && (
              <div className="flex flex-col gap-2.5 border-t border-line-inverse pt-3">
                <span className="text-xs text-on-inverse-muted">
                  Вся история · {day(0)} — {day(series.length - 1)}
                </span>
                <HistoryStrip
                  points={series.map((p) => ({ t: new Date(`${p.date}T12:00:00`).getTime(), y: p.value }))}
                  win={w}
                  onMove={(edge, index) => setWindow(moveEdge(w, edge, index, series.length))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <EdgeStepper
                    label="С"
                    name="Начало графика"
                    date={day(w.a)}
                    onPrev={stepEdge(w, "a", -1, series.length) ? () => setWindow(stepEdge(w, "a", -1, series.length)) : null}
                    onNext={stepEdge(w, "a", 1, series.length) ? () => setWindow(stepEdge(w, "a", 1, series.length)) : null}
                  />
                  <EdgeStepper
                    label="По"
                    name="Конец графика"
                    date={day(w.b)}
                    onPrev={stepEdge(w, "b", -1, series.length) ? () => setWindow(stepEdge(w, "b", -1, series.length)) : null}
                    onNext={stepEdge(w, "b", 1, series.length) ? () => setWindow(stepEdge(w, "b", 1, series.length)) : null}
                  />
                </div>
              </div>
            )}
          </section>

          <h2 className={`${sectionTitle} px-5 pt-1.5`}>По датам</h2>
          <div className="mx-4 flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
            {history.map((h) => (
              <button
                key={h.date}
                type="button"
                onClick={() => setEditing(h.session)}
                aria-label={`${fullDate(h.date)}: ${formatNumber(h.value)}${unit}. Изменить или удалить замер`}
                className="grid min-h-12 grid-cols-[minmax(0,1fr)_64px_64px_16px] items-center gap-2 border-t border-line px-3.5 text-left first:border-t-0"
              >
                <span className="font-mono text-sm text-ink-muted">{fullDate(h.date)}</span>
                <span className={`text-right font-mono text-[15px] font-bold ${h.computed ? "text-ink-muted" : ""}`}>{formatNumber(h.value)}</span>
                <span className="flex justify-end text-ink-muted">{h.delta !== null && <Delta value={h.delta} unit={type.unit} />}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
          <p className="px-5 text-xs leading-snug text-ink-muted">
            Стрелка — разница с предыдущим значением.{history.some((h) => h.computed) && " Серым — посчитано."} Тап по дате — изменить или удалить весь замер.
          </p>
        </>
      )}

      <MeasurementSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        types={types}
        sessions={sessions}
        session={editing}
        heightCm={height}
        onAskHeight={() => setHeightOpen(true)}
      />
      {heightOpen && <HeightSheet open onClose={() => setHeightOpen(false)} current={height} />}
    </div>
  );
}
