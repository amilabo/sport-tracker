"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { SearchInput } from "@/components/ui/Field";
import { techniqueOf } from "@/content/technique";
import { filterExercises, presentGroups } from "@/domain/exercise-search";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import type { Exercise, MuscleGroup } from "@/domain/types";
import { BookIcon } from "./Technique";

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
}

/** Search by name + muscle group filter + list. Shared by the catalog and the exercise picker. */
export function ExerciseBrowser({ exercises, onSelect, footer, autoFocus, disabledIds = [], onPreview }: ExerciseBrowserProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const groups = useMemo(() => presentGroups(exercises), [exercises]);
  const found = useMemo(() => filterExercises(exercises, query, group), [exercises, query, group]);

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

      <ul className="flex flex-col" aria-live="polite">
        {found.map((e) => {
          const disabled = disabledIds.includes(e.id);
          return (
            <li key={e.id} className="flex items-center gap-1.5 border-b border-line last:border-b-0">
              {/* The book sits on the left, away from the thumb's tap on the row (which picks at once). */}
              {onPreview &&
                (techniqueOf(e) ? (
                  <button
                    type="button"
                    onClick={() => onPreview(e)}
                    aria-label={`Как делать: ${e.name}`}
                    className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] border-ink">
                      <BookIcon />
                    </span>
                  </button>
                ) : (
                  <span aria-hidden="true" className="-ml-1 w-11 shrink-0" />
                ))}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(e)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 text-left disabled:opacity-40"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base leading-snug font-semibold">{e.name}</span>
                  <span className="text-[13px] text-ink-muted">
                    {MUSCLE_GROUP_LABELS[e.muscle_group]} · {EQUIPMENT_LABELS[e.equipment]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {found.length === 0 && <p className="py-2 text-[15px] text-ink-muted">Ничего не нашлось</p>}
      {footer?.(query)}
    </div>
  );
}
