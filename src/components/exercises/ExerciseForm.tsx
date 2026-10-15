"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Field, FormError } from "@/components/ui/Field";
import type { ExerciseInput } from "@/db/repos/exercises";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/domain/labels";
import { DomainError, EQUIPMENT, LOG_TYPES, MUSCLE_GROUPS, type Equipment, type LogType, type MuscleGroup } from "@/domain/types";

const LOG_TYPE_OPTIONS: Record<LogType, { title: string; example: string }> = {
  weight_reps: { title: "Вес × раз", example: "жим лёжа: 40 кг × 12 раз" },
  reps: { title: "Только раз", example: "отжимания: 15 раз" },
  bodyweight_plus: { title: "Свой вес ± кг × раз", example: "подтягивания с поясом +10 кг, гравитрон −20 кг" },
  time: { title: "Время", example: "планка: 0:45" },
  cardio: { title: "Время и скорость", example: "дорожка: 15 мин × 10 км/ч" },
};

interface ExerciseFormProps {
  id: string;
  initial?: Partial<ExerciseInput>;
  /** The log type cannot change once the exercise has history (PRD §3.1). */
  logTypeLocked?: boolean;
  onSubmit: (input: ExerciseInput) => Promise<void>;
}

/** Name, muscle group, equipment and log type. Submit with a button outside: <button form={id}>. */
export function ExerciseForm({ id, initial, logTypeLocked, onSubmit }: ExerciseFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState<MuscleGroup | null>(initial?.muscle_group ?? null);
  const [equipment, setEquipment] = useState<Equipment | null>(initial?.equipment ?? null);
  const [logType, setLogType] = useState<LogType>(initial?.log_type ?? "weight_reps");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Введите название упражнения");
    if (!group) return setError("Выберите группу мышц");
    if (!equipment) return setError("Выберите оборудование");
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name, muscle_group: group, equipment, log_type: logType });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
      if (!(err instanceof DomainError)) console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={id} onSubmit={submit} aria-busy={busy} className="flex flex-col gap-5">
      <Field label="Название" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" enterKeyHint="done" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-ink-muted">Группа мышц</legend>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} on={group === g} onClick={() => setGroup(g)}>
              {MUSCLE_GROUP_LABELS[g]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-ink-muted">Оборудование</legend>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((q) => (
            <Chip key={q} on={equipment === q} onClick={() => setEquipment(q)}>
              {EQUIPMENT_LABELS[q]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={logTypeLocked}>
        <legend className="mb-2 text-xs text-ink-muted">Как записывать подход</legend>
        {logTypeLocked && (
          <p className="text-[13px] text-ink-muted">Тип записи нельзя изменить: по упражнению уже есть история.</p>
        )}
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {LOG_TYPES.map((t) => {
            const on = logType === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setLogType(t)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                  on ? "border-accent bg-surface-raised" : "border-line bg-surface"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-accent" : "border-line-strong"}`}
                >
                  {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{LOG_TYPE_OPTIONS[t].title}</span>
                  <span className="text-[13px] text-ink-muted">{LOG_TYPE_OPTIONS[t].example}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <FormError message={error} />
    </form>
  );
}
