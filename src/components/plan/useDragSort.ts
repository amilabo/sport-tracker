"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface DragState {
  from: number;
  to: number;
  dy: number;
}

interface Measure {
  /** Page coordinates at drag start. */
  rects: { top: number; height: number }[];
  pointerPageY: number;
}

const EDGE = 90;
const SCROLL_STEP = 14;

/**
 * Drag-to-reorder by a handle, without libraries. While dragging, the list renders compact
 * (`dragging === true`), so a long plan fits on the screen; the grabbed row is kept under the finger.
 */
export function useDragSort(onMove: (from: number, to: number) => void, gap = 12) {
  const itemEls = useRef<(HTMLElement | null)[]>([]);
  const [state, setState] = useState<DragState | null>(null);
  // The same state for event handlers: they must not depend on which render created them.
  const live = useRef<DragState | null>(null);
  const measure = useRef<Measure | null>(null);
  const grab = useRef<{ index: number; clientY: number } | null>(null);

  const update = (next: DragState | null) => {
    live.current = next;
    setState(next);
  };

  // After the compact re-render: keep the grabbed row under the finger, then measure all rows.
  useLayoutEffect(() => {
    if (!state || measure.current || !grab.current) return;
    const el = itemEls.current[grab.current.index];
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollBy(0, r.top + r.height / 2 - grab.current.clientY);
    measure.current = {
      pointerPageY: grab.current.clientY + window.scrollY,
      rects: itemEls.current.map((node) => {
        const b = node?.getBoundingClientRect();
        return { top: (b?.top ?? 0) + window.scrollY, height: b?.height ?? 0 };
      }),
    };
  }, [state]);

  const finish = (commit: boolean) => {
    const s = live.current;
    measure.current = null;
    grab.current = null;
    update(null);
    if (commit && s && s.from !== s.to) onMove(s.from, s.to);
  };

  const handleProps = (index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      grab.current = { index, clientY: e.clientY };
      measure.current = null;
      update({ from: index, to: index, dy: 0 });
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const m = measure.current;
      const s = live.current;
      if (!m || !s) return;
      if (e.clientY < EDGE) window.scrollBy(0, -SCROLL_STEP);
      else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP);
      const dy = e.clientY + window.scrollY - m.pointerPageY;
      const r = m.rects[s.from];
      const center = r.top + r.height / 2 + dy;
      const to = m.rects.filter((x, i) => i !== s.from && x.top + x.height / 2 < center).length;
      update({ from: s.from, to, dy });
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
    style: { touchAction: "none" } as React.CSSProperties,
  });

  const itemStyle = (index: number): React.CSSProperties => {
    const m = measure.current;
    if (!state || !m) return {};
    if (index === state.from) {
      return { transform: `translateY(${state.dy}px)`, zIndex: 10, position: "relative" };
    }
    const shift = (m.rects[state.from]?.height ?? 0) + gap;
    let y = 0;
    if (state.from < state.to && index > state.from && index <= state.to) y = -shift;
    if (state.from > state.to && index >= state.to && index < state.from) y = shift;
    return { transform: `translateY(${y}px)`, transition: "transform 150ms ease" };
  };

  const itemRef = (index: number) => (el: HTMLElement | null) => {
    itemEls.current[index] = el;
  };

  return { dragging: state !== null, draggingIndex: state?.from ?? null, handleProps, itemStyle, itemRef };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
