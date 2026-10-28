"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { SearchInput } from "@/components/ui/Field";
import { techniqueOf } from "@/content/technique";
import { filterExercises, presentGroups } from "@/domain/exercise-search";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import type { Exercise, MuscleGroup } from "@/domain/types";
import { BookIcon } from "./Technique";

/** A row of a suggestion section: the second line replaces «группа · оборудование», the mark goes under it. */
export interface BrowserRow {
  exercise: Exercise;
  line?: string | null;
  mark?: string | null;
}

export interface BrowserSection {
  title: string;
  rows: BrowserRow[];
  /** «Ваша замена»: one dark row. */
  inverse?: boolean;
}

interface ExerciseBrowserProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  /** Rendered after the results, gets the current query (e.g. "+ Создать новое: «тяга»"). */
  footer?: (query: string) => React.ReactNode;
  autoFocus?: boolean;
  /** Ids shown as unavailable (e.g. the exercise being replaced). */
  disabledIds?: string[];
  /** «Как делать» before choosing: a book button on rows that have a description. */
  onPreview?: (exercise: Exercise) => void;
  /** Shown instead of the whole list while the search is empty and the filter is «Все». */
  sections?: BrowserSection[] | null;
}

/** Search by name + muscle group filter + list. Shared by the catalog and the exercise picker. */
export function ExerciseBrowser({ exercises, onSelect, footer, autoFocus, disabledIds = [], onPreview, sections }: ExerciseBrowserProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const groups = useMemo(() => presentGroups(exercises), [exercises]);
  const found = useMemo(() => filterExercises(exercises, query, group), [exercises, query, group]);
  const suggesting = !!sections && !query.trim() && group === null;

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        label="Поиск упражнения"
        placeholder="Найти упражнение"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Группа мышц">
        <Chip on={group === null} onClick={() => setGroup(null)} className="shrink-0">
          Все
        </Chip>
        {groups.map((g) => (
          <Chip key={g} on={group === g} onClick={() => setGroup(group === g ? null : g)} className="shrink-0">
            {MUSCLE_GROUP_LABELS[g]}
          </Chip>
        ))}
      </div>

      {suggesting ? (
        <div className="flex flex-col" aria-live="polite">
          {sections.filter((s) => s.rows.length).map((s) => (
            <section key={s.title} aria-label={s.title} className="flex flex-col">
              <h3 className="mt-2 mb-1 font-display text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">{s.title}</h3>
              <ul className="flex flex-col">
                {s.rows.map((r) => (
                  <ExerciseRow
                    key={r.exercise.id}
                    exercise={r.exercise}
                    line={r.line}
                    mark={r.mark}
                    inverse={s.inverse}
                    disabled={disabledIds.includes(r.exercise.id)}
                    onSelect={onSelect}
                    onPreview={onPreview}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <>
          <ul className="flex flex-col" aria-live="polite">
            {found.map((e) => (
              <ExerciseRow key={e.id} exercise={e} disabled={disabledIds.includes(e.id)} onSelect={onSelect} onPreview={onPreview} />
            ))}
          </ul>
          {found.length === 0 && <p className="py-2 text-[15px] text-ink-muted">Ничего не нашлось</p>}
        </>
      )}
      {footer?.(query)}
    </div>
  );
}

interface ExerciseRowProps {
  exercise: Exercise;
  line?: string | null;
  mark?: string | null;
  inverse?: boolean;
  disabled?: boolean;
  onSelect: (exercise: Exercise) => void;
  onPreview?: (exercise: Exercise) => void;
}

function ExerciseRow({ exercise: e, line, mark, inverse, disabled, onSelect, onPreview }: ExerciseRowProps) {
  const muted = inverse ? "text-on-inverse-muted" : "text-ink-muted";
  return (
    <li
      className={`flex items-center gap-1.5 ${
        inverse ? "rounded-2xl bg-surface-inverse px-2 text-on-inverse" : "border-b border-line last:border-b-0"
      }`}
    >
      {/* The book sits on the left, away from the thumb's tap on the row (which picks at once). */}
      {onPreview &&
        (techniqueOf(e) ? (
          <button
            type="button"
            onClick={() => onPreview(e)}
            aria-label={`Как делать: ${e.name}`}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${inverse ? "" : "-ml-1"}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] ${inverse ? "border-on-inverse" : "border-ink"}`}>
              <BookIcon />
            </span>
          </button>
        ) : (
          <span aria-hidden="true" className={`w-11 shrink-0 ${inverse ? "" : "-ml-1"}`} />
        ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(e)}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 text-left disabled:opacity-40"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base leading-snug font-semibold">{e.name}</span>
          <span className={`text-[13px] ${muted}`}>{line ?? `${MUSCLE_GROUP_LABELS[e.muscle_group]} · ${EQUIPMENT_LABELS[e.equipment]}`}</span>
          {mark && <span className={`font-mono text-xs ${muted}`}>{mark}</span>}
        </span>
      </button>
    </li>
  );
}
