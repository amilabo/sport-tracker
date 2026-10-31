"use client";

import { formatValue } from "@/domain/chart-series";
import { MONTHS } from "@/domain/rhythm";
import type { ChainSeries } from "@/domain/progression";

// «Вся прогрессия» on one chart (stage 45, mockup А7): a band per level, the hardest on top; inside a band each
// workout's best, scaled between the level's worst and best; dashed — moving to the next variant. Chart tokens only.

const W = 322;
const BAND = 60;
const GAP = 6;
const PAD_X = 14;
/** Inside a band: the label row on top, then the line between these offsets. */
const LINE_TOP = 22;
const LINE_BOTTOM = 8;
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3).toLowerCase());

function dm(t: number) {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First days of months between `from` and `to`, as x ticks. */
function monthTicks(from: number, to: number): number[] {
  const out: number[] = [];
  const d = new Date(from);
  const cur = new Date(d.getFullYear(), d.getMonth(), 1);
  while (cur.getTime() <= to) {
    out.push(cur.getTime());
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function ProgressionChart({ series }: { series: ChainSeries }) {
  const { levels, from, to } = series;
  if (from === null || to === null) return null;
  const n = levels.length;
  const H = n * BAND + (n - 1) * GAP;
  const x = (t: number) => (to === from ? W / 2 : PAD_X + ((t - from) / (to - from)) * (W - PAD_X * 2));
  // Level 1 at the bottom.
  const bandTop = (level: number) => (n - level) * (BAND + GAP);
  const y = (level: number, norm: number) => bandTop(level) + LINE_TOP + (1 - norm) * (BAND - LINE_TOP - LINE_BOTTOM);
  const xy = levels.map((l) => l.points.map((p) => ({ ...p, cx: x(p.t), cy: y(l.level, p.norm) })));

  // Month labels: skip ones closer than 36 px to the previous shown one. The first month, started before the first
  // workout, sits at the left edge — a month starting right after it wins the place.
  const ticks: { t: number; cx: number }[] = [];
  for (const t of monthTicks(from, to)) {
    const cx = Math.max(x(Math.max(t, from)), PAD_X);
    const prev = ticks.at(-1);
    if (!prev || cx - prev.cx >= 36) ticks.push({ t, cx });
    else if (prev.t < from && ticks.length === 1) ticks[0] = { t, cx };
  }

  const description = levels
    .filter((l) => l.points.length)
    .map((l) => {
      const p = l.points;
      const range = p.length > 1 ? `от ${formatValue(l.exercise.log_type, p[0].value)} до ${formatValue(l.exercise.log_type, p.at(-1)!.value)}` : formatValue(l.exercise.log_type, p[0].value);
      return `${l.exercise.name}: ${dm(p[0].t)}${p.length > 1 ? `–${dm(p.at(-1)!.t)}` : ""}, ${range}`;
    })
    .join("; ");

  const last = series.current ? xy[series.current.level - 1].at(-1) : undefined;

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-label={description} className="block overflow-visible">
      {levels.map((l) => (
        <g key={l.exercise.id}>
          <rect x={0} y={bandTop(l.level)} width={W} height={BAND} rx={8} className="fill-on-inverse" opacity={0.07} />
          <text x={8} y={bandTop(l.level) + 15} className="fill-on-inverse-muted font-mono" fontSize={10}>
            {l.level} · {l.exercise.name.length > 40 ? `${l.exercise.name.slice(0, 39)}…` : l.exercise.name}
          </text>
        </g>
      ))}
      {/* Dashed: from the last workout on a level to the first one on the next level that was done. */}
      {xy.map((pts, i) => {
        const next = xy.slice(i + 1).find((p) => p.length);
        const a = pts.at(-1);
        const b = next?.[0];
        if (!a || !b || b.t < a.t) return null;
        return <line key={`tr-${i}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} className="stroke-chart-line" strokeWidth={2} strokeDasharray="4 4" />;
      })}
      {xy.map((pts, i) =>
        pts.length > 1 ? (
          <polyline
            key={`l-${i}`}
            points={pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
            fill="none"
            className="stroke-chart-line"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null,
      )}
      {xy.map((pts, i) => {
        const p = pts.at(-1);
        if (!p || p === last) return null;
        return <circle key={`end-${i}`} cx={p.cx} cy={p.cy} r={4.5} className="fill-surface-inverse stroke-chart-line" strokeWidth={2.5} />;
      })}
      {last && <circle cx={last.cx} cy={last.cy} r={5.5} className="fill-chart-line" />}
      {ticks.map((tk) => (
        <text key={tk.t} x={tk.cx} y={H + 18} className="fill-chart-label font-mono" fontSize={10}>
          {MONTHS_SHORT[new Date(tk.t).getMonth()]}
        </text>
      ))}
    </svg>
  );
}
