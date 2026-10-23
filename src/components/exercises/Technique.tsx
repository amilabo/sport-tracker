"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { GENERAL_TIP } from "@/content/exercise-descriptions";
import { techniqueHint, upperFirst, type Technique } from "@/content/technique";
import { plural } from "@/domain/format";
import { EQUIPMENT_LABELS, LOG_TYPE_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import type { Exercise } from "@/domain/types";

export function BookIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function exerciseMeta(e: Exercise) {
  return `${MUSCLE_GROUP_LABELS[e.muscle_group]} · ${EQUIPMENT_LABELS[e.equipment]} · запись: ${LOG_TYPE_LABELS[e.log_type]}`;
}

/** Steps with numbers and the dark «Важно» plate, or the person's own text as typed. Large type: read at arm's length. */
export function TechniqueBody({ technique, tip = true }: { technique: Technique; tip?: boolean }) {
  if (technique.kind === "own") return <p className="text-base leading-[1.45] whitespace-pre-line">{technique.text}</p>;
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3.5">
        {technique.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink font-mono text-sm font-bold">
              {i + 1}
            </span>
            <span className="pt-1 text-base leading-[1.45]">
              <span className="sr-only">Шаг {i + 1}. </span>
              {step}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-inverse px-4 py-3.5 text-on-inverse">
        <span className="font-display text-[11px] font-bold tracking-[0.06em] text-accent-on-inverse uppercase">Важно</span>
        <span className="text-base leading-[1.45]">{upperFirst(technique.important)}</span>
      </div>
      {tip && <p className="text-[13px] leading-[1.45] text-ink-muted">{GENERAL_TIP}</p>}
    </div>
  );
}

/** Name, meta line and the body — the content of the sheet and of the picker's preview. */
export function TechniqueContent({ exercise, technique }: { exercise: Exercise; technique: Technique }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[21px] leading-[1.15] font-extrabold tracking-[-0.01em]">{exercise.name}</h3>
        <p className="text-[13px] text-ink-muted">{exerciseMeta(exercise)}</p>
      </div>
      <TechniqueBody technique={technique} />
    </div>
  );
}

interface TechniqueSheetProps {
  exercise: Exercise | null;
  technique: Technique | null;
  onClose: () => void;
  /** The workout's guard for links out of an unsaved draft. */
  onLeave?: (e: React.MouseEvent) => void;
}

/** «Как делать» over the workout: the session stays as it was, the sheet only reads. */
export function TechniqueSheet({ exercise, technique, onClose, onLeave }: TechniqueSheetProps) {
  return (
    <Sheet
      open={!!exercise && !!technique}
      onClose={onClose}
      title="Как делать"
      footer={
        exercise && (
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink variant="outline" href={`/exercises/view/?id=${exercise.id}`} onClick={onLeave}>
              История и график
            </ButtonLink>
            <Button variant="primary" onClick={onClose}>
              Понятно
            </Button>
          </div>
        )
      }
    >
      {exercise && technique && <TechniqueContent exercise={exercise} technique={technique} />}
    </Sheet>
  );
}

/** The row on top of an opened workout card: «Как делать» + the one thing to watch. */
export function TechniqueHintButton({ technique, onClick }: { technique: Technique; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-13 w-full items-center gap-3 rounded-xl bg-surface-done py-2 pr-2.5 pl-2 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inverse text-on-inverse">
        <BookIcon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold">Как делать</span>
        <span className="truncate text-[13px] text-ink-muted">{techniqueHint(technique)}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

interface TechniqueBlockProps {
  technique: Technique | null;
  /** Open at first while there is no history: a new exercise is read before it is done. */
  defaultOpen: boolean;
  /** Own exercise without a text: offer to write one. */
  onAdd?: () => void;
}

/** The collapsible «Как делать» on the exercise screen, above the chart. */
export function TechniqueBlock({ technique, defaultOpen, onAdd }: TechniqueBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (!technique) {
    if (!onAdd) return null;
    return (
      <button
        type="button"
        onClick={onAdd}
        className="mx-4 mt-4 flex min-h-13 items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line-strong px-3.5 text-left text-[15px] font-semibold"
      >
        <BookIcon className="shrink-0" />
        Как делать: добавить описание
      </button>
    );
  }
  const n = technique.kind === "catalog" ? technique.steps.length : 0;
  const steps = n ? `${n} ${plural(n, ["шаг", "шага", "шагов"])}` : null;
  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-start gap-3 px-3.5 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-inverse text-on-inverse">
          <BookIcon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 pt-px">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-xs font-bold tracking-[0.04em] uppercase">Как делать</span>
            {steps && <span className="font-mono text-xs text-ink-muted">{steps}</span>}
          </span>
          {!open && <span className="line-clamp-2 text-[13px] leading-[1.4] text-ink-muted">{techniqueHint(technique)}</span>}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`mt-2 shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5">
          <TechniqueBody technique={technique} />
        </div>
      )}
    </section>
  );
}
