"use client";

import { useState } from "react";
import { HeightSheet } from "@/components/body/HeightSheet";
import { MeasurementSheet } from "@/components/body/MeasurementSheet";
import { LineChart } from "@/components/charts/LineChart";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { measurementsRepo } from "@/db/repos/measurements";
import { settingsRepo } from "@/db/repos/settings";
import { groupSessions, seriesOf, shortDate, tileLine, valueOf, type BodySession, type TileLine } from "@/domain/body";
import { formatNumber } from "@/domain/format";
import type { MeasurementType } from "@/domain/types";

// The «Тело» screen layout (PRD §3.10): 3 rows of 2 tiles; fat and muscle show kg and % in one tile.
const TILE_ROWS: string[][][] = [
  [["weight"], ["bmi"]],
  [["fat_kg", "fat_pct"], ["muscle_kg", "muscle_pct"]],
  [["waist"], ["hips"]],
];
const TILE_KEYS = new Set(TILE_ROWS.flat(2));

function Delta({ line }: { line: TileLine }) {
  if (line.delta === null) return null;
  const d = line.delta;
  const dir = d > 0 ? "up" : d < 0 ? "down" : "flat";
  const unit = line.type.unit ? ` ${line.type.unit}` : "";
  return (
    <span
      aria-label={dir === "flat" ? "без изменений" : `${dir === "up" ? "выросло" : "снизилось"} на ${formatNumber(Math.abs(d))}${unit}`}
      className="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-[9px] bg-surface-done px-2 font-mono text-[15px] font-bold whitespace-nowrap"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "up" ? "M12 19V5M6 11l6-6 6 6" : dir === "down" ? "M12 5v14M6 13l6 6 6-6" : "M5 12h14"} />
      </svg>
      {dir === "flat" ? "0" : formatNumber(Math.abs(d))}
    </span>
  );
}

function ValueLine({ line, latestDate }: { line: TileLine; latestDate: string | null }) {
  return (
    <span className="flex items-center justify-between gap-1.5">
      <span className="font-display text-[22px] leading-none font-extrabold whitespace-nowrap">
        {line.value === null ? "—" : formatNumber(line.value)}
        {line.value !== null && line.type.unit && <span className="ml-0.5 font-sans text-[15px] font-semibold">{line.type.unit}</span>}
      </span>
      {line.value !== null && line.date !== latestDate ? (
        <span className="font-mono text-[11px] text-ink-muted">{shortDate(line.date!)}</span>
      ) : (
        <Delta line={line} />
      )}
    </span>
  );
}

export default function BodyPage() {
  const { data } = useLive(
    async () => {
      const [types, measurements, settings] = await Promise.all([
        measurementsRepo.listTypes({ includeArchived: true }),
        measurementsRepo.list(),
        settingsRepo.get(),
      ]);
      return { types, sessions: groupSessions(measurements), height: settings.height_cm };
    },
    [],
    ["measurement_types", "measurements", "settings"],
  );
  const [selected, setSelected] = useState("weight");
  const [pct, setPct] = useState(false);
  const [editing, setEditing] = useState<BodySession | "new" | null>(null);
  const [heightOpen, setHeightOpen] = useState(false);

  if (!data) return <PageHeader title="Тело" />;
  const { types, sessions, height } = data;
  const byKey = (key: string) => types.find((t) => t.key === key);
  const line = (t: MeasurementType) => tileLine(t, sessions, types, height);
  const latest = sessions[0]?.date ?? null;
  const previous = sessions[1]?.date ?? null;

  // Selected tile: built-in key, or the id of another type. Fat/muscle tiles switch kg ↔ %.
  const tile = TILE_ROWS.flat().find((keys) => keys[0] === selected);
  const chartType = tile ? byKey(tile.length > 1 && pct ? tile[1] : tile[0]) : types.find((t) => t.id === selected);
  const series = chartType ? seriesOf(chartType, sessions, types, height) : [];
  const others = types.filter((t) => !t.archived_at && !TILE_KEYS.has(t.key ?? ""));
  const tableTypes = types.filter((t) => sessions.some((s) => valueOf(t, s, types, height)));

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <div className="flex flex-col gap-1.5">
        <PageHeader
          title="Тело"
          action={
            <Button variant="accent" className="whitespace-nowrap" onClick={() => setEditing("new")}>
              + Замер
            </Button>
          }
        />
        {latest && (
          <p className="px-5 text-[15px] text-ink-muted">
            Замер {shortDate(latest)}
            {previous && ` · стрелки — к ${shortDate(previous)}`}
          </p>
        )}
      </div>

      {sessions.length === 0 && (
        <section className="mx-4 flex flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4">
          <span className="text-[15px] font-semibold">Замеров пока нет</span>
          <span className="text-[13px] leading-snug text-ink-muted">
            «+ Замер» — дата и значения: вес, жир, мышцы, талия, бёдра и другие. Пустые поля не сохраняются. ИМТ и проценты посчитаются сами.
          </span>
        </section>
      )}

      <div className="flex flex-col gap-2 px-4">
        {TILE_ROWS.map((row, r) => (
          <div key={r} className="grid grid-cols-2 gap-2">
            {row.map((keys) => {
              const tileTypes = keys.map(byKey).filter((t): t is MeasurementType => !!t);
              if (!tileTypes.length) return <div key={keys[0]} />;
              const on = selected === keys[0];
              const isBmi = keys[0] === "bmi";
              return (
                <button
                  key={keys[0]}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (isBmi && !height) return setHeightOpen(true);
                    setSelected(keys[0]);
                  }}
                  className={`flex flex-col gap-2.5 rounded-2xl border-[1.5px] p-3 text-left ${on ? "border-accent bg-surface-raised" : "border-line bg-surface"}`}
                >
                  <span className="text-[15px] font-semibold text-ink-muted">{tileTypes[0].name}</span>
                  {isBmi && !height ? (
                    <span className="text-[13px] leading-snug font-semibold underline underline-offset-2">Указать рост для ИМТ</span>
                  ) : (
                    tileTypes.map((t) => <ValueLine key={t.id} line={line(t)} latestDate={latest} />)
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {sessions.length > 0 && chartType && (
        <section className="mx-4 flex flex-col gap-2.5 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-col gap-0.5">
              <span className="font-display text-sm font-bold">
                {chartType.name}
                {chartType.unit && `, ${chartType.unit}`}
              </span>
              {series.length > 0 && (
                <span className="font-mono text-xs text-on-inverse-muted">
                  {formatNumber(Math.min(...series.map((p) => p.value)))} – {formatNumber(Math.max(...series.map((p) => p.value)))}
                </span>
              )}
            </span>
            {tile && tile.length > 1 && (
              <span role="radiogroup" aria-label="Единицы" className="flex gap-1">
                {[false, true].map((p) => (
                  <button
                    key={String(p)}
                    type="button"
                    role="radio"
                    aria-checked={pct === p}
                    onClick={() => setPct(p)}
                    className={`h-11 min-w-11 rounded-[9px] border-[1.5px] border-line-inverse px-2.5 text-[13px] font-semibold ${
                      pct === p ? "bg-on-inverse text-surface-inverse" : "text-on-inverse-muted"
                    }`}
                  >
                    {p ? "%" : "кг"}
                  </button>
                ))}
              </span>
            )}
          </div>
          {series.length > 0 ? (
            <LineChart
              points={series.map((p) => ({ t: new Date(`${p.date}T12:00:00`).getTime(), y: p.value, xLabel: shortDate(p.date) }))}
              formatY={(v) => formatNumber(v)}
              ariaLabel={`График: ${chartType.name} по датам`}
            />
          ) : (
            <p className="py-6 text-center text-[13px] text-on-inverse-muted">
              {chartType.computed === "bmi" ? "Нужны вес и рост." : "Этот замер ещё не вводили."}
            </p>
          )}
        </section>
      )}

      {others.length > 0 && sessions.length > 0 && (
        <section className="mx-4 flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
          {others.map((t) => {
            const l = line(t);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected === t.id}
                onClick={() => setSelected(t.id)}
                className={`flex min-h-14 items-center gap-3 border-t border-line px-3.5 py-2 text-left first:border-t-0 ${selected === t.id ? "bg-surface-raised" : ""}`}
              >
                <span className="flex-1 text-[15px] font-semibold">{t.name}</span>
                <span className="font-mono text-[15px] font-bold">{l.value === null ? "—" : `${formatNumber(l.value)} ${t.unit}`}</span>
                {l.value !== null && (l.date === latest ? <Delta line={l} /> : <span className="font-mono text-[11px] text-ink-muted">{shortDate(l.date!)}</span>)}
              </button>
            );
          })}
        </section>
      )}

      {sessions.length > 0 && (
        <section className="flex flex-col gap-2 px-4">
          <h2 className="px-1 font-display text-xs font-bold tracking-[0.04em] uppercase">Все замеры</h2>
          <div className="overflow-x-auto rounded-2xl border-[1.5px] border-line bg-surface">
            <table className="border-collapse text-[13px] whitespace-nowrap">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col" className="sticky left-0 bg-surface px-3 py-2.5 font-medium">
                    Дата
                  </th>
                  {tableTypes.map((t) => (
                    <th key={t.id} scope="col" className="px-2 py-2.5 font-medium">
                      {t.name}
                      {t.unit === "%" ? " %" : t.key === "fat_kg" || t.key === "muscle_kg" ? " кг" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.date} className="border-t border-line font-mono">
                    <th scope="row" className="sticky left-0 bg-surface p-0 text-left font-sans font-normal">
                      <button type="button" onClick={() => setEditing(s)} className="min-h-11 px-3 text-ink-muted underline underline-offset-2">
                        {shortDate(s.date)}
                        {s.date.slice(0, 4) !== String(new Date().getFullYear()) && `.${s.date.slice(2, 4)}`}
                      </button>
                    </th>
                    {tableTypes.map((t) => {
                      const v = valueOf(t, s, types, height);
                      return (
                        <td key={t.id} className={`px-2 py-2.5 font-bold ${v?.computed ? "text-ink-muted" : ""}`}>
                          {v ? formatNumber(v.value) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-1 text-xs leading-snug text-ink-muted">
            Тап по дате — изменить или удалить замер. Серым — посчитано: ИМТ по весу и росту{height ? ` (${height} см)` : ""}, проценты жира и мышц из килограммов, если их не ввели вручную.{" "}
            <button type="button" onClick={() => setHeightOpen(true)} className="font-semibold underline underline-offset-2">
              {height ? "Изменить рост" : "Указать рост"}
            </button>
          </p>
        </section>
      )}

      <MeasurementSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        types={types}
        session={editing === "new" ? null : editing}
        heightCm={height}
        onAskHeight={() => setHeightOpen(true)}
      />
      {heightOpen && <HeightSheet open onClose={() => setHeightOpen(false)} current={height} />}
    </div>
  );
}
