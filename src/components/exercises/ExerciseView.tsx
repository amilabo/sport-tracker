"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { EQUIPMENT_LABELS, LOG_TYPE_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import { DomainError } from "@/domain/types";
import { ExerciseForm } from "./ExerciseForm";

/** Exercise card. Stage 2: details, edit, archive. History and the progress chart come in stage 8. */
export function ExerciseView() {
  const id = useSearchParams().get("id") ?? "";
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useLive(
    async () => {
      const [exercise, hasHistory, plans] = await Promise.all([
        exercisesRepo.get(id),
        exercisesRepo.hasHistory(id),
        exercisesRepo.usedInPlans(id),
      ]);
      return { exercise, hasHistory, plans };
    },
    [id],
    ["exercises", "plans", "plan_exercises", "workout_exercises"],
  );

  const exercise = data?.exercise;
  if (!loading && !exercise) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Упражнение" backHref="/exercises/" />
        <p className="px-4 text-[15px] text-ink-muted">Упражнение не найдено.</p>
      </div>
    );
  }
  if (!exercise || !data) return <PageHeader title="Упражнение" backHref="/exercises/" />;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-8">
      <PageHeader
        title="Упражнение"
        backHref="/exercises/"
        action={
          <Button size="md" variant="outline" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        }
      />

      <div className="flex flex-col gap-2 px-4">
        <h1 className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.01em]">{exercise.name}</h1>
        <p className="text-sm text-ink-muted">
          {MUSCLE_GROUP_LABELS[exercise.muscle_group]} · {EQUIPMENT_LABELS[exercise.equipment]} · запись: {LOG_TYPE_LABELS[exercise.log_type]}
        </p>
        {exercise.archived_at && (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface p-3">
            <span className="flex-1 text-sm">В архиве: не видно в каталоге и при выборе упражнения. История сохранена.</span>
            <Button size="md" variant="primary" onClick={() => run(() => exercisesRepo.restore(exercise.id))}>
              Вернуть
            </Button>
          </div>
        )}
        <FormError message={error} />
      </div>

      <section className="mt-6 flex flex-col gap-2 px-4">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">История подходов</h2>
        {!data.hasHistory && <p className="text-[15px] text-ink-muted">Пока не выполнялось.</p>}
      </section>

      {data.plans.length > 0 && (
        <section className="mt-6 flex flex-col gap-2 px-4">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">В планах</h2>
          <p className="text-[15px]">{data.plans.map((p) => p.name).join(", ")}</p>
        </section>
      )}

      {!exercise.archived_at && (
        <div className="mt-auto px-4 pt-8">
          <Button variant="quiet" className="w-full" onClick={() => setArchiving(true)}>
            Убрать в архив
          </Button>
        </div>
      )}

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Изменить упражнение"
        footer={
          <Button variant="primary" type="submit" form="edit-exercise" className="w-full">
            Сохранить
          </Button>
        }
      >
        <ExerciseForm
          id="edit-exercise"
          initial={exercise}
          logTypeLocked={data.hasHistory}
          onSubmit={async (input) => {
            await exercisesRepo.update(exercise.id, input);
            setEditing(false);
          }}
        />
        <p className="mt-4 text-[13px] text-ink-muted">Новое название появится везде: в планах, истории и графиках.</p>
      </Sheet>

      <Sheet
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Убрать в архив?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setArchiving(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                run(async () => {
                  await exercisesRepo.archive(exercise.id);
                  setArchiving(false);
                })
              }
            >
              В архив
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-[15px]">
          {data.plans.length > 0 && (
            <p className="rounded-xl border-2 border-accent bg-surface p-3 font-semibold">
              Используется в планах: {data.plans.map((p) => p.name).join(", ")}
            </p>
          )}
          <p>
            «{exercise.name}» пропадёт из каталога и из выбора упражнений.
            {data.plans.length > 0 && " В этих планах оно останется."} История и графики сохранятся, вернуть можно в «Ещё → Архив».
          </p>
        </div>
      </Sheet>
    </div>
  );
}
