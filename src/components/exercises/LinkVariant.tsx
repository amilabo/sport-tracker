"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { progressionsRepo } from "@/db/repos/progressions";
import { DomainError, type Exercise } from "@/domain/types";
import { ExercisePicker } from "./ExercisePicker";

interface LinkVariantProps {
  exercise: Exercise;
  /** true — the exercise is already in a chain (no name to ask). */
  inChain: boolean;
  open: boolean;
  onClose: () => void;
}

/** «Связать с вариантом» (PRD §3.1.2): pick an exercise, say whether it is easier or harder. */
export function LinkVariant({ exercise, inChain, open, onClose }: LinkVariantProps) {
  const [other, setOther] = useState<Exercise | null>(null);
  const [name, setName] = useState(exercise.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOther(null);
    setError(null);
    onClose();
  }

  async function link(side: "easier" | "harder") {
    if (!other) return;
    setBusy(true);
    setError(null);
    try {
      await progressionsRepo.link(exercise.id, other.id, side, name);
      close();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось связать. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const askName = !inChain && !other?.progression_id;

  return (
    <>
      <ExercisePicker open={open && !other} onClose={close} onPick={setOther} title="Связать с вариантом" disabledIds={[exercise.id]} />
      <Sheet open={open && !!other} onClose={close} title="Это вариант проще или сложнее?">
        {other && (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-snug">
              «{other.name}» по сравнению с «{exercise.name}»:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="xl" onClick={() => link("easier")} disabled={busy}>
                Проще
              </Button>
              <Button variant="primary" size="xl" onClick={() => link("harder")} disabled={busy}>
                Сложнее
              </Button>
            </div>
            {askName && <Field label="Название прогрессии" value={name} onChange={(e) => setName(e.target.value)} hint="Например, «Подтягивания» или «Отжимания»" />}
            <p className="text-[13px] leading-snug text-ink-muted">
              У вариантов может быть разный способ записи: гравитрон с помощью −кг и подтягивания с резинкой «на раз» — нормально. График у каждого свой, а во вкладке «Вся прогрессия» видно, когда был переход.
            </p>
            <FormError message={error} />
            <Button variant="quiet" onClick={() => setOther(null)} disabled={busy}>
              Выбрать другое упражнение
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
