"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { techniqueOf } from "@/content/technique";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { canCreateFromQuery } from "@/domain/exercise-search";
import { cleanName } from "@/domain/text";
import type { Exercise } from "@/domain/types";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseForm } from "./ExerciseForm";
import { TechniqueContent } from "./Technique";

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  disabledIds?: string[];
  /** The main button under «Как делать»: «Заменить на это», «Добавить»… */
  pickLabel?: string;
}

/** Choose an exercise from the catalog or create a new one right here (PRD §3.2: fast plan entry). */
export function ExercisePicker({ open, onClose, onPick, title = "Добавить упражнение", disabledIds, pickLabel = "Выбрать" }: ExercisePickerProps) {
  const [creating, setCreating] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<Exercise | null>(null);
  const { data: exercises = [] } = useLive(() => exercisesRepo.list(), [], ["exercises"]);

  function close() {
    setCreating(null);
    setPreviewing(null);
    onClose();
  }

  function pick(e: Exercise) {
    setCreating(null);
    setPreviewing(null);
    onPick(e);
  }

  const creatingNew = creating !== null;
  const technique = previewing && techniqueOf(previewing);
  return (
    <Sheet
      open={open}
      onClose={close}
      title={creatingNew ? "Новое упражнение" : previewing ? "Как делать" : title}
      footer={
        creatingNew ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setCreating(null)}>
              Назад к списку
            </Button>
            <Button variant="primary" type="submit" form="picker-new-exercise">
              Создать
            </Button>
          </div>
        ) : (
          previewing && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setPreviewing(null)}>
                К списку
              </Button>
              <Button variant="primary" onClick={() => pick(previewing)} disabled={disabledIds?.includes(previewing.id)}>
                {pickLabel}
              </Button>
            </div>
          )
        )
      }
    >
      {creatingNew ? (
        <ExerciseForm
          id="picker-new-exercise"
          initial={{ name: creating }}
          onSubmit={async (input) => pick(await exercisesRepo.create(input))}
        />
      ) : (
        <>
          {previewing && technique && (
            <PreviewPane>
              <TechniqueContent exercise={previewing} technique={technique} />
            </PreviewPane>
          )}
          {/* Hidden, not unmounted: the search and the group filter are still there on «К списку». */}
          <div hidden={!!previewing}>
            <ExerciseBrowser
              exercises={exercises}
              onSelect={pick}
              onPreview={setPreviewing}
              disabledIds={disabledIds}
              autoFocus
              footer={(query) => (
                <button
                  type="button"
                  onClick={() => setCreating(cleanName(query))}
                  className="min-h-12 rounded-xl border-[1.5px] border-dashed border-ink px-3 text-left text-[15px] font-semibold text-accent-text"
                >
                  {canCreateFromQuery(exercises, query) ? `+ Создать новое: «${cleanName(query)}»` : "+ Создать новое упражнение"}
                </button>
              )}
            />
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Starts the preview at the top and puts the list back where it was scrolled to. */
function PreviewPane({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroller = ref.current?.parentElement;
    if (!scroller) return;
    const was = scroller.scrollTop;
    scroller.scrollTop = 0;
    return () => {
      // The list is shown again in the same commit; restore after it has its height back.
      requestAnimationFrame(() => (scroller.scrollTop = was));
    };
  }, []);
  return <div ref={ref}>{children}</div>;
}
