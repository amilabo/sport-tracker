"use client";

import { useState, type MouseEvent } from "react";

export interface LinePoint {
  /** Time in ms: points are placed by date, not evenly. */
  t: number;
  y: number;
  /** Small label above the dot ("×12"). */
  label?: string | null;
  /** Date under the dot ("07.10"). */
  xLabel: string;
  /** Shown in a callout when the dot is tapped ("16.10.2026 · 64,5 кг"). */
  detail?: string;
}

interface LineChartProps {
  points: LinePoint[];
  formatY: (value: number) => string;
  ariaLabel: string;
  /** A shaded stretch from `fromT` to the end with a caption — «4 на одном уровне» (stage 41). */
  band?: { fromT: number; label: string } | null;
  /** A smoothed line over the dots (weight trend, stage 43): then the dots are muted and the trend is the accent line. */
  trend?: { t: number; y: number }[] | null;
}

const W = 326;
const H = 156;
// Left gutter holds the Y labels, so dot labels never collide with them.
const LEFT = 36;
const RIGHT = 14;
const TOP = 26;
const BOTTOM = 118;
// Callout: monospace 11px, so its width follows the number of characters.
const CALLOUT_CHAR = 6.7;
const CALLOUT_PAD = 9;
const CALLOUT_H = 24;

/** Line with dots on a dark card (mockup «Упражнение»). Colors only from chart tokens. */
export function LineChart({ points, formatY, ariaLabel, band, trend }: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return null;
  const ys = [...points.map((p) => p.y), ...(trend ?? []).map((p) => p.y)];
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    const pad = Math.max(Math.abs(max) * 0.1, 1);
    min -= pad;
    max += pad;
  }
  const t0 = points[0].t;
  const t1 = points.at(-1)!.t;
  const x = (t: number) => (t1 === t0 ? (LEFT + W - RIGHT) / 2 : LEFT + ((t - t0) / (t1 - t0)) * (W - LEFT - RIGHT));
  const y = (v: number) => BOTTOM - ((v - min) / (max - min)) * (BOTTOM - TOP);
  const xy = points.map((p) => ({ ...p, cx: x(p.t), cy: y(p.y) }));

  // Date labels: skip ones that would overlap the previous shown label; always keep the last.
  const shown = new Set<number>();
  let lastX = -Infinity;
  xy.forEach((p, i) => {
    if (p.cx - lastX >= 44 || i === xy.length - 1) {
      if (i === xy.length - 1 && p.cx - lastX < 44 && shown.size) shown.delete([...shown].at(-1)!);
      shown.add(i);
      lastX = p.cx;
    }
  });
  const dotLabels = xy.length <= 8;
  const tappable = xy.some((p) => p.detail);

  // A tap picks the nearest dot by X; tapping it again hides the callout.
  function onTap(e: MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.cx - vx) < Math.abs(xy[best].cx - vx)) best = i;
    });
    setActive((cur) => (cur === best ? null : best));
  }

  const callout = active !== null ? xy[active] : null;
  const calloutText = callout?.detail ?? "";
  const cw = calloutText.length * CALLOUT_CHAR + CALLOUT_PAD * 2;
  const calloutX = callout ? Math.min(Math.max(callout.cx - cw / 2, 0), W - cw) : 0;
  const above = callout ? callout.cy - 12 - CALLOUT_H : 0;
  const calloutY = callout ? (above >= -4 ? above : callout.cy + 12) : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      onClick={tappable ? onTap : undefined}
      className={`block overflow-visible ${tappable ? "cursor-pointer touch-manipulation select-none" : ""}`}
    >
      {band && band.fromT >= t0 && t1 > t0 && (
        <g aria-hidden="true">
          <rect x={x(band.fromT) - 12} y={TOP - 18} width={W - x(band.fromT) + 12} height={BOTTOM - TOP + 26} rx={8} className="fill-on-inverse" opacity={0.07} />
          <text x={(x(band.fromT) + W) / 2} y={BOTTOM - 2} textAnchor="middle" className="fill-on-inverse-muted font-mono" fontSize={10}>
            {band.label}
          </text>
        </g>
      )}
      {[max, (max + min) / 2, min].map((v, i) => (
        <g key={i}>
          <line x1={LEFT - 6} x2={W} y1={y(v)} y2={y(v)} className="stroke-chart-grid" strokeWidth={1} />
          {i !== 1 && (
            <text x={LEFT - 10} y={y(v) + 3.5} textAnchor="end" className="fill-chart-label font-mono" fontSize={10}>
              {formatY(v)}
            </text>
          )}
        </g>
      ))}
      {trend && trend.length > 1 && (
        <polyline
          points={trend.map((p) => `${x(p.t)},${y(p.y)}`).join(" ")}
          fill="none"
          className="stroke-chart-line"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {xy.length > 1 && !trend && (
        <polyline
          points={xy.map((p) => `${p.cx},${p.cy}`).join(" ")}
          fill="none"
          className="stroke-chart-line"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {xy.map((p, i) => (
        <g key={`${p.t}-${i}`}>
          {i === active && <line x1={p.cx} x2={p.cx} y1={TOP - 8} y2={BOTTOM} className="stroke-chart-label" strokeWidth={1} strokeDasharray="3 3" />}
          <circle
            cx={p.cx}
            cy={p.cy}
            r={i === active ? 6.5 : trend ? 4 : 5}
            className={`${i === active ? "fill-chart-line" : "fill-surface-inverse"} ${trend && i !== active ? "stroke-on-inverse-muted" : "stroke-chart-line"}`}
            strokeWidth={trend ? 2 : 2.5}
          />
          {dotLabels && p.label && i !== active && (
            <text x={p.cx} y={p.cy - 10} textAnchor="middle" className="fill-on-inverse font-mono" fontSize={10} fontWeight={700}>
              {p.label}
            </text>
          )}
          {shown.has(i) && (
            <text
              x={Math.min(Math.max(p.cx, LEFT), W - 16)}
              y={H - 6}
              textAnchor="middle"
              className="fill-chart-label font-mono"
              fontSize={10}
            >
              {p.xLabel}
            </text>
          )}
        </g>
      ))}
      {callout && calloutText && (
        <g aria-hidden="true">
          <rect x={calloutX} y={calloutY} width={cw} height={CALLOUT_H} rx={8} className="fill-on-inverse" />
          <text x={calloutX + cw / 2} y={calloutY + 16} textAnchor="middle" className="fill-surface-inverse font-mono" fontSize={11} fontWeight={700}>
            {calloutText}
          </text>
        </g>
      )}
    </svg>
  );
}
