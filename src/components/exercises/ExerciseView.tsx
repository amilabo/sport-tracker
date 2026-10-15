"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { progressionsRepo } from "@/db/repos/progressions";
import { EQUIPMENT_LABELS, LOG_TYPE_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import { DomainError } from "@/domain/types";
import { ExerciseForm } from "./ExerciseForm";
import { ExerciseProgress } from "./ExerciseProgress";
import { LinkVariant } from "./LinkVariant";
import { ProgressionPanel } from "./ProgressionPanel";

/** Exercise card: details, best result, progress chart, set history; edit and archive. */
export function ExerciseView() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [tab, setTab] = useState<"own" | "chain">(params.get("tab") === "chain" ? "chain" : "own");
  const [linking, setLinking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useLive(
    async () => {
      const [exercise, hasHistory, plans, chain] = await Promise.all([
        exercisesRepo.get(id),
        exercisesRepo.hasHistory(id),
        exercisesRepo.usedInPlans(id),
        progressionsRepo.chainOf(id),
      ]);
      return { exercise, hasHistory, plans, chain };
    },
    [id],
    ["exercises", "plans", "plan_exercises", "workout_exercises", "progressions"],
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
        <p className="text-sm">
          <span className="text-ink-muted">В планах: </span>
          {data.plans.length > 0 ? data.plans.map((p) => p.name).join(", ") : <span className="text-ink-muted">нет</span>}
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

      {data.chain && (
        <div role="tablist" aria-label="Вид" className="mx-4 mt-5 grid grid-cols-2 gap-1 rounded-[14px] bg-surface-done p-1">
          {(
            [
              ["own", "Это упражнение"],
              ["chain", "Вся прогрессия"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`h-11 rounded-[10px] text-sm font-semibold ${tab === key ? "bg-surface-inverse text-on-inverse" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {data.chain && tab === "chain" ? <ProgressionPanel chain={data.chain} current={exercise} /> : <ExerciseProgress exercise={exercise} />}

      <div className="mt-6 px-4">
        <Button variant="outline" className="w-full" onClick={() => setLinking(true)}>
          {data.chain ? "Добавить вариант в прогрессию" : "Связать с вариантом"}
        </Button>
        {!data.chain && (
          <p className="mt-2 text-[13px] leading-snug text-ink-muted">
            Чтобы видеть прогресс, когда упражнение усложняется: «Гравитрон → Подтягивания с резинкой → Подтягивания».
          </p>
        )}
      </div>
      <LinkVariant key={exercise.id} exercise={exercise} inChain={!!data.chain} open={linking} onClose={() => setLinking(false)} />


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
