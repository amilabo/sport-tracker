"use client";

import { Sheet } from "@/components/ui/Sheet";
import type { LocalDate } from "@/domain/types";
import { fullDate } from "./parts";

/** Picks one of the measurement dates for «Было» or «Стало» (period «Даты»). */
export function DatePickSheet({
  open,
  onClose,
  title,
  dates,
  selected,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Newest first. */
  dates: { date: LocalDate; note: string }[];
  selected: LocalDate | null;
  onPick: (date: LocalDate) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
        {dates.map(({ date, note }) => {
          const on = date === selected;
          return (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onPick(date);
                onClose();
              }}
              className={`flex min-h-[52px] items-center gap-3 border-t border-line px-3.5 text-left first:border-t-0 ${on ? "bg-surface-raised" : ""}`}
            >
              <span className="flex-1 font-mono text-[15px] font-bold">{fullDate(date)}</span>
              <span className="text-[13px] text-ink-muted">{note}</span>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-accent-line" : "border-line-strong"}`}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full bg-accent-line" />}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
