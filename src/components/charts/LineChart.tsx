export interface LinePoint {
  /** Time in ms: points are placed by date, not evenly. */
  t: number;
  y: number;
  /** Small label above the dot ("×12"). */
  label?: string | null;
  /** Date under the dot ("07.10"). */
  xLabel: string;
}

interface LineChartProps {
  points: LinePoint[];
  formatY: (value: number) => string;
  ariaLabel: string;
}

const W = 326;
const H = 156;
// Left gutter holds the Y labels, so dot labels never collide with them.
const LEFT = 36;
const RIGHT = 14;
const TOP = 26;
const BOTTOM = 118;

/** Line with dots on a dark card (mockup «Упражнение»). Colors only from chart tokens. */
export function LineChart({ points, formatY, ariaLabel }: LineChartProps) {
  if (!points.length) return null;
  const ys = points.map((p) => p.y);
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} className="block overflow-visible">
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
      {xy.length > 1 && (
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
          <circle cx={p.cx} cy={p.cy} r={5} className="fill-surface-inverse stroke-chart-line" strokeWidth={2.5} />
          {dotLabels && p.label && (
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
    </svg>
  );
}
