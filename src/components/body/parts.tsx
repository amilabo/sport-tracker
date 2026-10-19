"use client";

import { useLive } from "@/db/hooks";
import { measurementsRepo } from "@/db/repos/measurements";
import { settingsRepo } from "@/db/repos/settings";
import { groupSessions, type SeriesPoint } from "@/domain/body";
import { formatNumber } from "@/domain/format";
import type { LocalDate } from "@/domain/types";

/** Types (archived too: their old values stay visible), sessions newest first, height — live. */
export function useBodyData() {
  return useLive(
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
  ).data;
}

const ARROWS = { up: "M12 19V5M6 11l6-6 6 6", down: "M12 5v14M6 13l6 6 6-6", flat: "M5 12h14" };

/** A change: a neutral arrow and the absolute value, no «good / bad» color (PRD §3.10). */
export function Delta({ value, unit, size = 13, className = "" }: { value: number | null; unit?: string; size?: number; className?: string }) {
  if (value === null) return <span className={className} aria-label="нет сравнения">—</span>;
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const u = unit ? ` ${unit}` : "";
  return (
    <span
      aria-label={dir === "flat" ? "без изменений" : `${dir === "up" ? "выросло" : "снизилось"} на ${formatNumber(Math.abs(value))}${u}`}
      className={`inline-flex items-center gap-0.5 font-mono font-bold whitespace-nowrap ${className}`}
      style={{ fontSize: size }}
    >
      <svg width={size - 3} height={size - 3} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ARROWS[dir]} />
      </svg>
      {dir === "flat" ? "0" : formatNumber(Math.abs(value))}
    </span>
  );
}

const time = (date: LocalDate) => new Date(`${date}T12:00:00`).getTime();

/**
 * A tiny line of all values with the compared stretch (from … to) in the accent.
 * `tone` — the surface under it: paper (lines of the accent-line shade) or a dark panel (chart tokens).
 */
export function Sparkline({
  series,
  from,
  to,
  width,
  height,
  tone,
}: {
  series: SeriesPoint[];
  from: LocalDate | null;
  to: LocalDate | null;
  width: number;
  height: number;
  tone: "paper" | "inverse";
}) {
  if (!series.length) return <svg width={width} height={height} aria-hidden="true" />;
  const pad = tone === "inverse" ? 6 : 2.5;
  const ys = series.map((p) => p.value);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min || 1;
  const t0 = time(series[0].date);
  const t1 = time(series.at(-1)!.date);
  const pts = series.map((p) => ({
    date: p.date,
    x: t1 === t0 ? width / 2 : pad + ((time(p.date) - t0) / (t1 - t0)) * (width - 2 * pad),
    y: series.length === 1 ? height / 2 : height - pad - ((p.value - min) / span) * (height - 2 * pad),
  }));
  const line = (list: typeof pts) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const part = pts.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
  const end = part.at(-1) ?? pts.at(-1)!;
  const start = from ? part[0] : null;
  const base = tone === "inverse" ? "stroke-line-inverse" : "stroke-line-strong";
  const accent = tone === "inverse" ? "stroke-chart-line" : "stroke-accent-line";
  const dot = tone === "inverse" ? "fill-chart-line" : "fill-accent-line";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0 overflow-visible">
      <polyline points={line(pts)} fill="none" className={base} strokeWidth={tone === "inverse" ? 2 : 1.5} strokeLinejoin="round" strokeLinecap="round" />
      {part.length > 1 && (
        <polyline points={line(part)} fill="none" className={accent} strokeWidth={tone === "inverse" ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {tone === "inverse" && start && start !== end && (
        <circle cx={start.x} cy={start.y} r="3.5" className="fill-surface-inverse stroke-chart-line" strokeWidth="2" />
      )}
      <circle cx={end.x} cy={end.y} r={tone === "inverse" ? 4.5 : 2.5} className={dot} />
    </svg>
  );
}

/** «29.09», or «07.10.24» when the year differs from the reference date's (the latest measurement). */
export function dayLabel(date: LocalDate, reference: LocalDate | null): string {
  const [y, m, d] = date.split("-");
  return reference && reference.slice(0, 4) !== y ? `${d}.${m}.${y.slice(2)}` : `${d}.${m}`;
}

/** «29.09.2026» */
export function fullDate(date: LocalDate): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";
