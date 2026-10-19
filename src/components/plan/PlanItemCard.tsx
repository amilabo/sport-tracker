"use client";

import { forwardRef, useEffect, useRef } from "react";
import { QUICK_INPUT_EXAMPLES, QUICK_INPUT_LABELS } from "@/domain/quick-input";
import { formatSet, formatSetsSummary } from "@/domain/sets";
import type { Exercise, SetValues } from "@/domain/types";

export interface EditorRow {
  key: string;
  id?: string;
  exercise: Exercise;
  note: string | null;
  sets: (SetValues & { id?: string })[];
  text: string;
  error: string | null;
}

interface PlanItemCardProps {
  row: EditorRow;
  index: number;
  compact: boolean;
  lifted: boolean;
  handleProps: React.HTMLAttributes<HTMLElement> & { style?: React.CSSProperties };
  style: React.CSSProperties;
  onText: (text: string) => void;
  onEditSet: (setIndex: number) => void;
  onAddSet: () => void;
  onMenu: () => void;
  autoFocus?: boolean;
}

export const PlanItemCard = forwardRef<HTMLDivElement, PlanItemCardProps>(function PlanItemCard(
  { row, index, compact, lifted, handleProps, style, onText, onEditSet, onAddSet, onMenu, autoFocus },
  ref,
) {
  const logType = row.exercise.log_type;
  const num = String(index + 1).padStart(2, "0");
  const inputId = `quick-${row.key}`;
  const inputRef = useRef<HTMLInputElement>(null);

  // A just-added exercise gets the cursor in its quick input. Wait for the picker sheet to close:
  // a closing <dialog> returns focus to the button that opened it.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      style={style}
      className={`flex flex-col gap-2.5 rounded-[18px] border-[1.5px] bg-surface p-3 ${
        row.error ? "border-danger" : lifted ? "border-accent-line shadow-lg" : "border-line"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={`Перетащить: ${row.exercise.name}`}
          className="-my-2 -ml-1 flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-line-strong active:cursor-grabbing"
          {...handleProps}
        >
          <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" aria-hidden="true">
            <rect y="1" width="16" height="2" rx="1" />
            <rect y="6" width="16" height="2" rx="1" />
            <rect y="11" width="16" height="2" rx="1" />
          </svg>
        </button>
        <span className="font-mono text-[13px] font-bold text-ink-muted">{num}</span>
        <span className="min-w-0 flex-1 text-[15px] leading-snug font-semibold">
          {row.exercise.name}
          {compact && <span className="block font-mono text-[13px] font-normal text-ink-muted">{formatSetsSummary(logType, row.sets)}</span>}
        </span>
        {!compact && (
          <button
            type="button"
            onClick={onMenu}
            aria-label={`Ещё действия: ${row.exercise.name}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}
      </div>

      {!compact && (
        <>
          <label htmlFor={inputId} className="flex flex-col gap-1 text-xs text-ink-muted">
            {QUICK_INPUT_LABELS[logType]}
            <input
              id={inputId}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
              ref={inputRef}
              value={row.text}
              onChange={(e) => onText(e.target.value)}
              placeholder={QUICK_INPUT_EXAMPLES[logType]}
              aria-invalid={row.error ? true : undefined}
              aria-describedby={row.error ? `${inputId}-err` : undefined}
              className="h-12 rounded-xl border-[1.5px] border-ink bg-bg px-3 font-mono text-[17px] font-bold text-ink placeholder:font-normal placeholder:text-ink-faint"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {row.sets.map((s, i) => (
              <button
                key={s.id ?? i}
                type="button"
                onClick={() => onEditSet(i)}
                aria-label={`Подход ${i + 1}: ${formatSet(logType, s)}. Изменить`}
                className="min-h-11 rounded-[9px] border-[1.5px] border-line bg-surface-raised px-2.5 font-mono text-[13px] font-bold"
              >
                {formatSet(logType, s)}
              </button>
            ))}
            {!row.error && (
              <button
                type="button"
                onClick={onAddSet}
                aria-label="Добавить подход"
                className="min-h-11 rounded-[9px] border-[1.5px] border-dashed border-line-strong px-2.5 text-[13px] font-semibold text-ink-muted"
              >
                + подход
              </button>
            )}
          </div>
          {row.error && (
            <p id={`${inputId}-err`} className="text-[13px] font-semibold text-danger">
              {row.error}
            </p>
          )}
          {row.note && <p className="rounded-[10px] bg-bg px-2.5 py-2 text-[13px] text-ink-muted">Заметка: {row.note}</p>}
        </>
      )}
    </div>
  );
});
