"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { measurementsRepo } from "@/db/repos/measurements";
import { formatBodyValue, inputTypes, parseBodyValue, valueOf, type BodySession } from "@/domain/body";
import { formatNumber } from "@/domain/format";
import { toLocalDate } from "@/domain/time";
import { DomainError, type Id, type MeasurementType } from "@/domain/types";

interface MeasurementSheetProps {
  open: boolean;
  onClose: () => void;
  types: MeasurementType[];
  /** null — a new measurement for today. */
  session: BodySession | null;
  heightCm: number | null;
  onAskHeight: () => void;
}

/** «+ Замер» and editing a date (PRD §3.10): empty fields are not saved; goal ≤ 1 min. */
export function MeasurementSheet(props: MeasurementSheetProps) {
  // Remount per opened session, so the form starts from that session's values.
  return props.open ? <Form key={props.session?.date ?? "new"} {...props} /> : <Sheet open={false} onClose={props.onClose} title="Замер">{null}</Sheet>;
}

function Form({ onClose, types, session, heightCm, onAskHeight }: MeasurementSheetProps) {
  const fields = inputTypes(types);
  const [date, setDate] = useState(session?.date ?? toLocalDate());
  const [values, setValues] = useState<Record<Id, string>>(() =>
    Object.fromEntries(fields.map((t) => [t.id, session?.entered.has(t.id) ? formatBodyValue(session.entered.get(t.id)!) : ""])),
  );
  const [invalid, setInvalid] = useState<Set<Id>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newType, setNewType] = useState<{ name: string; unit: string } | null>(null);

  // Live preview of computed values (BMI, % from kg) for what is typed now.
  const typed: BodySession = { date, entered: new Map() };
  for (const t of fields) {
    const v = parseBodyValue(t, values[t.id] ?? "");
    if (typeof v === "number") typed.entered.set(t.id, v);
  }
  const bmiType = types.find((t) => t.computed === "bmi");
  const bmi = bmiType ? valueOf(bmiType, typed, types, heightCm) : null;

  async function save() {
    setError(null);
    const bad = new Set<Id>();
    const map = new Map<Id, number | null>();
    for (const t of fields) {
      const v = parseBodyValue(t, values[t.id] ?? "");
      if (v === undefined) bad.add(t.id);
      else map.set(t.id, v);
    }
    setInvalid(bad);
    if (bad.size) return setError("Проверьте выделенные значения");
    try {
      await measurementsRepo.saveSession(date, map, session?.date);
      onClose();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
    }
  }

  async function addType() {
    if (!newType) return;
    try {
      await measurementsRepo.createType(newType);
      setNewType(null);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось добавить замер.");
    }
  }

  const label = (t: MeasurementType) => (t.unit ? `${t.name}, ${t.unit}` : t.name);
  const computedHint = (t: MeasurementType) => {
    if (t.computed !== "percent_of_weight" || values[t.id]) return undefined;
    const v = valueOf(t, typed, types, heightCm);
    return v ? `посчитается: ${formatNumber(v.value)} %` : "можно не вводить — посчитается из кг и веса";
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={session ? "Изменить замер" : "Новый замер"}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={save}>
            Сохранить
          </Button>
          {session && (
            <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
              Удалить замер
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          Дата
          <input
            type="date"
            value={date}
            max={toLocalDate()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
          {fields.map((t) => (
            <Field
              key={t.id}
              label={label(t)}
              inputMode="decimal"
              value={values[t.id] ?? ""}
              aria-invalid={invalid.has(t.id) || undefined}
              className={invalid.has(t.id) ? "border-accent-text" : ""}
              hint={computedHint(t)}
              onChange={(e) => {
                setValues({ ...values, [t.id]: e.target.value });
                if (invalid.has(t.id)) setInvalid(new Set([...invalid].filter((x) => x !== t.id)));
              }}
            />
          ))}
        </div>

        <div className="rounded-[14px] bg-surface-done px-3 py-2.5 text-[13px] leading-snug">
          {heightCm ? (
            <>ИМТ: {bmi ? <b className="font-mono">{formatNumber(bmi.value)}</b> : "введите вес"} · рост {heightCm} см</>
          ) : (
            <>
              ИМТ считается по весу и росту.{" "}
              <button type="button" onClick={onAskHeight} className="font-semibold underline underline-offset-2">
                Указать рост
              </button>
            </>
          )}
        </div>

        {newType ? (
          <div className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-dashed border-line-strong p-3">
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <Field label="Свой замер" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} placeholder="Плечо" />
              <Field label="Единица" value={newType.unit} onChange={(e) => setNewType({ ...newType, unit: e.target.value })} placeholder="см" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setNewType(null)}>
                Отмена
              </Button>
              <Button variant="primary" onClick={addType}>
                Добавить
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" onClick={() => setNewType({ name: "", unit: "см" })}>
            + Свой тип замера
          </Button>
        )}
        <FormError message={error} />
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить замер?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
            <Button
              variant="accent"
              onClick={async () => {
                if (session) await measurementsRepo.deleteSession(session.date);
                setConfirmDelete(false);
                onClose();
              }}
            >
              Удалить
            </Button>
          </div>
        }
      >
        <p className="text-[15px]">Все значения этого замера будут удалены. Отменить нельзя.</p>
      </Sheet>
    </Sheet>
  );
}
