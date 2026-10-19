"use client";

import Link from "next/link";
import { useState } from "react";
import { DatePickSheet } from "@/components/body/DatePickSheet";
import { HeightSheet } from "@/components/body/HeightSheet";
import { MeasurementSheet } from "@/components/body/MeasurementSheet";
import { dayLabel, Delta, fullDate, sectionTitle, Sparkline, useBodyData } from "@/components/body/parts";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { shortDate, type BodySession } from "@/domain/body";
import {
  BODY_PERIODS,
  compareGroups,
  composition,
  enteredCount,
  periodDates,
  type BodyPeriod,
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

export default function BodyPage() {
  const data = useBodyData();
  const [period, setPeriod] = useState<BodyPeriod>("last");
  const [custom, setCustom] = useState<PeriodDates | null>(null);
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

  // «Даты» starts from the pair the screen showed last, so switching to it changes nothing at first.
  const shown = periodDates(sessions, period === "custom" ? "last" : period);
  const dates = period === "custom" ? periodDates(sessions, "custom", custom ?? shown) : shown;
  const groups = compareGroups(types, sessions, height, dates);
  const rows = groups.flatMap((g) => g.rows);
  const weight = rows.find((r) => r.type.key === "weight");
  const bmi = rows.find((r) => r.type.key === "bmi");
  const bmiType = types.find((t) => t.key === "bmi");
  const comp = composition(types, sessions, dates);
  const cap = latest ? caption(dates, latest, period) : "";
  const compared = sessions.length > 1;

  function choosePeriod(p: BodyPeriod) {
    if (p === "custom" && period !== "custom") setCustom(dates);
    setPeriod(p);
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
                  <button
                    type="button"
                    onClick={() => setPicking(side)}
                    aria-label={`${side === "a" ? "Было" : "Стало"}: ${dates[side] ? fullDate(dates[side]!) : "не выбрано"}, выбрать дату`}
                    className={`flex h-14 flex-col items-start justify-center gap-0.5 rounded-[14px] border-[1.5px] px-3 ${
                      side === "a" ? "border-line-strong bg-surface" : "border-ink bg-surface-raised"
                    }`}
                  >
                    <span className="text-xs text-ink-muted">{side === "a" ? "Было" : "Стало"}</span>
                    <span className="flex items-center gap-1.5 font-mono text-[15px] font-bold">
                      {dates[side] ? fullDate(dates[side]!) : "—"}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </button>
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
            <span className="mt-1.5">
              <Sparkline series={weight.series} from={weight.a?.date ?? null} to={weight.b.date} width={132} height={72} tone="inverse" />
            </span>
          </Link>
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
                  <Sparkline series={r.series} from={r.a?.date ?? null} to={r.b?.date ?? null} width={44} height={20} tone="paper" />
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
        onPick={(date) => picking && setCustom({ ...dates, [picking]: date })}
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
