"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { canCreateFromQuery } from "@/domain/exercise-search";
import { cleanName } from "@/domain/text";
import type { Exercise } from "@/domain/types";
import { ExerciseBrowser } from "./ExerciseBrowser";
import { ExerciseForm } from "./ExerciseForm";

interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  disabledIds?: string[];
}

/** Choose an exercise from the catalog or create a new one right here (PRD §3.2: fast plan entry). */
export function ExercisePicker({ open, onClose, onPick, title = "Добавить упражнение", disabledIds }: ExercisePickerProps) {
  const [creating, setCreating] = useState<string | null>(null);
  const { data: exercises = [] } = useLive(() => exercisesRepo.list(), [], ["exercises"]);

  function close() {
    setCreating(null);
    onClose();
  }

  function pick(e: Exercise) {
    setCreating(null);
    onPick(e);
  }

  const creatingNew = creating !== null;
  return (
    <Sheet
      open={open}
      onClose={close}
      title={creatingNew ? "Новое упражнение" : title}
      footer={
        creatingNew && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setCreating(null)}>
              Назад к списку
            </Button>
            <Button variant="primary" type="submit" form="picker-new-exercise">
              Создать
            </Button>
          </div>
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
        <ExerciseBrowser
          exercises={exercises}
          onSelect={pick}
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
      )}
    </Sheet>
  );
}
