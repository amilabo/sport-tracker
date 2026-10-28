"use client";

import { useRef, type PointerEvent } from "react";
import type { ChartWindow } from "@/domain/chart-window";

const W = 326;
const H = 48;
const PAD = 8;

interface HistoryStripProps {
  /** Times in ms and values of the whole history, oldest first. */
  points: { t: number; y: number }[];
  win: ChartWindow;
  /** Dragging: the edge nearer to the touch follows the finger, point by point. */
  onMove: (edge: "a" | "b", index: number) => void;
}

/**
 * The whole history under the big chart (stage 31, mockup 31): a thin line with the shown window framed.
 * Drag either edge with a finger; the «С» / «По» arrows below do the same by one point and work with a screen reader.
 */
export function HistoryStrip({ points, win, onMove }: HistoryStripProps) {
  const edge = useRef<"a" | "b" | null>(null);
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const span = Math.max(...ys) - min;
  const t0 = points[0].t;
  const t1 = points.at(-1)!.t;
  const xy = points.map((p) => ({
    x: t1 === t0 ? W / 2 : PAD + ((p.t - t0) / (t1 - t0)) * (W - 2 * PAD),
    y: span === 0 ? H / 2 : H - PAD - ((p.y - min) / span) * (H - 2 * PAD),
  }));
  const line = (list: typeof xy) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const xa = xy[win.a].x - 5;
  const xb = xy[win.b].x + 5;

  function nearest(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    xy.forEach((p, i) => {
      if (Math.abs(p.x - vx) < Math.abs(xy[best].x - vx)) best = i;
    });
    return { vx, index: best };
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      aria-hidden="true"
      className="block cursor-ew-resize touch-none select-none"
      onPointerDown={(e) => {
        const { vx, index } = nearest(e);
        edge.current = Math.abs(vx - xa) <= Math.abs(vx - xb) ? "a" : "b";
        e.currentTarget.setPointerCapture(e.pointerId);
        onMove(edge.current, index);
      }}
      onPointerMove={(e) => edge.current && onMove(edge.current, nearest(e).index)}
      onPointerUp={() => (edge.current = null)}
      onPointerCancel={() => (edge.current = null)}
    >
      <rect x={xa} y={2} width={Math.max(xb - xa, 10)} height={H - 4} rx={8} fill="none" className="stroke-chart-line" strokeWidth={1.5} />
      <polyline points={line(xy)} fill="none" className="stroke-chart-label" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {win.b > win.a && (
        <polyline points={line(xy.slice(win.a, win.b + 1))} fill="none" className="stroke-chart-line" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {[xa, xb].map((x, i) => (
        <rect key={i} x={x - 2} y={H / 2 - 10} width={4} height={20} rx={2} className="fill-on-inverse" />
      ))}
    </svg>
  );
}
