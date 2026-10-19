"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError, inputClass } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { measurementsRepo } from "@/db/repos/measurements";
import { formatBodyValue, inputTypes, parseBodyValue, seriesOf, shortDate, valueOf, type BodySession } from "@/domain/body";
import { formatNumber, plural } from "@/domain/format";
import { toLocalDate } from "@/domain/time";
import { DomainError, type Id, type LocalDate, type MeasurementType } from "@/domain/types";
import { sectionTitle } from "./parts";

interface MeasurementSheetProps {
  open: boolean;
  onClose: () => void;
  types: MeasurementType[];
  /** All sessions, newest first: the form shows the previous value of each field. */
  sessions: BodySession[];
  /** null — a new measurement for today. */
  session: BodySession | null;
  heightCm: number | null;
  onAskHeight: () => void;
}

// Groups of the form (mockup 18А): what the scales give, then what the tape gives.
const SCALE = ["weight", "fat_kg", "muscle_kg"];
const PERCENT = ["fat_pct", "muscle_pct"];
const TAPE = ["waist", "hips", "chest", "belly", "thigh"];

/** «+ Замер» and editing a date (PRD §3.10): empty fields are not saved; goal ≤ 1 min. */
export function MeasurementSheet(props: MeasurementSheetProps) {
  // Remount per opened session, so the form starts from that session's values.
  return props.open ? <Form key={props.session?.date ?? "new"} {...props} /> : <Sheet open={false} onClose={props.onClose} title="Замер">{null}</Sheet>;
}

function Form({ onClose, types, sessions, session, heightCm, onAskHeight }: MeasurementSheetProps) {
  const fields = inputTypes(types);
  const byKey = (keys: string[]) => keys.map((k) => fields.find((t) => t.key === k)).filter((t): t is MeasurementType => !!t);
  const scale = byKey(SCALE);
  const percent = byKey(PERCENT);
  const tape = byKey(TAPE);
  const known = new Set([...SCALE, ...PERCENT, ...TAPE]);
  const own = fields.filter((t) => !known.has(t.key ?? ""));

  const [date, setDate] = useState<LocalDate>(session?.date ?? toLocalDate());
  const [values, setValues] = useState<Record<Id, string>>(() =>
    Object.fromEntries(fields.map((t) => [t.id, session?.entered.has(t.id) ? formatBodyValue(session.entered.get(t.id)!) : ""])),
  );
  // Percentages are computed from kg unless typed in (InBody): the manual fields open when this date already has them.
  const [manualPct, setManualPct] = useState(() => percent.some((t) => session?.entered.has(t.id)));
  const [invalid, setInvalid] = useState<Set<Id>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newType, setNewType] = useState<{ name: string; unit: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const value = (t: MeasurementType) => values[t.id] ?? "";
  // The fields that are saved: percentages only when typed in by hand.
  const saved = fields.filter((t) => manualPct || !percent.includes(t));
  const filled = saved.filter((t) => typeof parseBodyValue(t, value(t)) === "number").length;

  // What is typed now, for computed previews (BMI, % from kg).
  const typed: BodySession = { date, entered: new Map() };
  for (const t of saved) {
    const v = parseBodyValue(t, value(t));
    if (typeof v === "number") typed.entered.set(t.id, v);
  }
  const bmiType = types.find((t) => t.computed === "bmi");
  const bmi = bmiType ? valueOf(bmiType, typed, types, heightCm) : null;

  // The previous measurement is the latest one before this date (the edited date itself is skipped).
  const earlier = sessions.filter((s) => s.date < date);
  const previousDate = earlier[0]?.date ?? null;
  const previous = (t: MeasurementType) => seriesOf(t, earlier, types, heightCm).at(-1) ?? null;

  async function save() {
    setError(null);
    const bad = new Set<Id>();
    const map = new Map<Id, number | null>();
    for (const t of fields) {
      const v = saved.includes(t) ? parseBodyValue(t, value(t)) : null;
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

  /** «Далее» on the keyboard: the next field, centred, so it never hides under the keyboard. */
  function next(current: HTMLInputElement) {
    const inputs = [...(formRef.current?.querySelectorAll<HTMLInputElement>("input[data-measure]") ?? [])];
    const after = inputs[inputs.indexOf(current) + 1];
    if (after) after.focus();
    else current.blur();
  }

  function row(t: MeasurementType, first: boolean, isLast: boolean) {
    const text = value(t);
    const parsed = parseBodyValue(t, text);
    const prev = previous(t);
    const bad = invalid.has(t.id) || (text.trim() !== "" && parsed === undefined);
    let sub = prev ? `было ${formatNumber(prev.value)}` : "";
    let changed = false;
    if (typeof parsed === "number" && prev) {
      const d = Math.round((parsed - prev.value) * 10) / 10;
      sub = d === 0 ? "как в прошлый раз" : `${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d))} к ${shortDate(prev.date)}`;
      changed = true;
    }
    if (bad) sub = t.unit === "%" ? "от 0 до 100" : "положительное число";
    const id = `measure-${t.id}`;
    return (
      <div key={t.id} className={`grid min-h-16 grid-cols-[minmax(0,1fr)_128px] items-center gap-2.5 px-3.5 py-2 ${first ? "" : "border-t border-line"}`}>
        <label htmlFor={id} className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{t.unit === "%" ? `${t.name}, %` : t.name}</span>
          <span className={`font-mono text-xs ${bad ? "font-bold text-danger" : changed ? "font-bold text-ink" : "text-ink-muted"}`}>{sub}</span>
        </label>
        <span className="relative block">
          <input
            id={id}
            data-measure
            inputMode="decimal"
            enterKeyHint={isLast ? "done" : "next"}
            autoComplete="off"
            value={text}
            aria-invalid={bad || undefined}
            onChange={(e) => {
              setValues({ ...values, [t.id]: e.target.value });
              if (invalid.has(t.id)) setInvalid(new Set([...invalid].filter((x) => x !== t.id)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                next(e.currentTarget);
              }
            }}
            // The keyboard takes a moment to open: then bring the field to the middle of what is left.
            onFocus={(e) => {
              const el = e.currentTarget;
              setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
            }}
            className={`${inputClass} pr-10 text-right font-mono text-[17px] font-bold ${bad ? "border-danger" : text ? "border-ink" : "border-line-strong"}`}
          />
          {t.unit && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-ink-muted">{t.unit}</span>}
        </span>
      </div>
    );
  }

  const order = [...scale, ...(manualPct ? percent : []), ...tape, ...own];
  const isLast = (t: MeasurementType) => order.at(-1) === t;
  const group = (list: MeasurementType[]) => list.map((t, i) => row(t, i === 0, isLast(t)));
  const card = "flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface";
  const groupTitle = `${sectionTitle} px-1 pt-1.5 text-[11px] text-ink-muted`;

  return (
    <Sheet
      open
      onClose={onClose}
      title={session ? "Изменить замер" : "Новый замер"}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={save}>
            Сохранить
            {filled > 0 && (
              <span className="font-medium text-on-inverse-muted">
                · {filled} {plural(filled, ["значение", "значения", "значений"])}
              </span>
            )}
          </Button>
          {session && (
            <Button variant="quiet" onClick={() => setConfirmDelete(true)}>
              Удалить замер
            </Button>
          )}
        </div>
      }
    >
      <div ref={formRef} className="flex flex-col gap-3">
        <label className="flex min-h-14 items-center justify-between gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface px-3.5">
          <span className="text-[15px] font-semibold">Дата</span>
          <input
            type="date"
            value={date}
            max={toLocalDate()}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-[10px] border-[1.5px] border-line-strong bg-surface-raised px-2.5 font-mono text-[15px] text-ink"
          />
        </label>

        {scale.length > 0 && (
          <>
            <div className="flex items-baseline justify-between">
              <h3 className={groupTitle}>Весы, InBody</h3>
              {previousDate && <span className="text-xs text-ink-muted">прошлый замер {shortDate(previousDate)}</span>}
            </div>
            <div className={card}>
              {group(scale)}
              {manualPct && percent.map((t) => row(t, false, isLast(t)))}
              {!manualPct && percent.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-line bg-surface-done px-3.5 py-2.5">
                  {percent.map((t) => {
                    const v = valueOf(t, typed, types, heightCm);
                    return (
                      <span key={t.id} className="flex justify-between text-sm text-ink-muted">
                        <span>{t.name}, % — из кг</span>
                        <b className="font-mono text-ink">{v ? `${formatNumber(v.value)} %` : "—"}</b>
                      </span>
                    );
                  })}
                </div>
              )}
              {percent.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (manualPct) setValues({ ...values, ...Object.fromEntries(percent.map((t) => [t.id, ""])) });
                    setManualPct(!manualPct);
                  }}
                  className="min-h-12 border-t border-line px-3.5 text-left text-sm font-semibold underline underline-offset-[3px]"
                >
                  {manualPct ? "Считать проценты из кг" : "Ввести проценты вручную (InBody)"}
                </button>
              )}
              {bmiType && (
                <div className="flex min-h-[52px] items-center justify-between gap-2 border-t border-line px-3.5 text-sm">
                  {heightCm ? (
                    <>
                      <span className="text-ink-muted">
                        ИМТ <span className="text-xs">· рост {heightCm} см</span>
                      </span>
                      <b className="font-mono text-[15px]">{bmi ? formatNumber(bmi.value) : "введите вес"}</b>
                    </>
                  ) : (
                    <>
                      <span className="text-ink-muted">ИМТ считается по весу и росту</span>
                      <button type="button" onClick={onAskHeight} className="min-h-11 font-semibold underline underline-offset-2">
                        Указать рост
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {tape.length > 0 && (
          <>
            <h3 className={groupTitle}>Сантиметр</h3>
            <div className={card}>{group(tape)}</div>
          </>
        )}

        {own.length > 0 && (
          <>
            <h3 className={groupTitle}>Свои</h3>
            <div className={card}>{group(own)}</div>
          </>
        )}

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
