"use client";

import { techniqueOf } from "@/content/technique";
import type { WorkoutItem } from "@/db/repos/workouts";
import { formatNumber, parseDecimal, parseDurationInput } from "@/domain/format";
import { formatCardioDuration, formatClock, formatSetsSummary } from "@/domain/sets";
import type { LogType, SetValues } from "@/domain/types";
import { fieldsFor, isExerciseDone, isFieldChanged, lastTimeDiffers, parseSignedWeight, stepValue, type SetField } from "@/domain/workout";
import { ValueStepper } from "./ValueStepper";
import { RestLine } from "./WorkRest";

interface ExerciseCardProps {
  item: WorkoutItem;
  index: number;
  total: number;
  open: boolean;
  /** Before "Начать": values can be changed, nothing can be marked done. */
  planning?: boolean;
  last: SetValues[] | undefined;
  onToggleOpen: () => void;
  onToggleDone: () => void;
  onToggleSet: (setIndex: number) => void;
  onValue: (setIndex: number, field: SetField, value: number | null) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onReplace: () => void;
  onNote: () => void;
  onSkip: () => void;
  onMove: (dir: -1 | 1) => void;
  /** Opens «Как делать»; the book button is shown only when the exercise has a description. */
  onTechnique: () => void;
  /** The circuit exercise to do now (stage 36): outlined. */
  current?: boolean;
  /** A circuit exercise done in the current round (stage 38): its ✓ and card show done until the next round. */
  roundDone?: boolean;
  /** «в плане 45 кг» under weights lowered after a break (stage 44). */
  planWeight?: string | null;
}

function unitOf(logType: LogType, field: SetField) {
  if (field === "weight") return "кг";
  if (field === "reps") return "раз";
  if (field === "speed_kmh") return "км/ч";
  return logType === "cardio" ? "мин" : "мин:сек";
}

function display(logType: LogType, field: SetField, v: number | null): string {
  if (v === null) return "—";
  if (field === "weight") return logType === "bodyweight_plus" && v > 0 ? `+${formatNumber(v, 2)}` : formatNumber(v, 2).replace("-", "−");
  if (field === "duration_sec") return logType === "cardio" ? formatCardioDuration(v).replace(" мин", "") : formatClock(v);
  return formatNumber(v, 2);
}

/** `reference` — known weights of this exercise, for the assistance minus (see parseSignedWeight). */
function parseTyped(logType: LogType, field: SetField, text: string, reference: (number | null)[]): number | null {
  if (field === "duration_sec") return parseDurationInput(text, logType === "cardio" ? "min" : "sec");
  if (field === "weight" && logType === "bodyweight_plus") {
    const w = parseSignedWeight(text, reference);
    return w !== null && Math.abs(w) <= 999 ? w : null;
  }
  const n = parseDecimal(text);
  if (n === null) return null;
  if (field === "reps") return Number.isInteger(n) && n >= 0 && n <= 999 ? n : null;
  if (field === "weight") return logType === "bodyweight_plus" ? (Math.abs(n) <= 999 ? n : null) : n >= 0 && n <= 999 ? n : null;
  return n > 0 && n <= 50 ? n : null;
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-1.5z" />
      <path d="M20 19.5V5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-1.5z" />
    </svg>
  );
}

function ArrowIcon({ up = false }: { up?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M12 19V5M6 11l6-6 6 6" : "M12 5v14M6 13l6 6 6-6"} />
    </svg>
  );
}

// The border color is separate: two border colors in one class list do not override each other reliably.
const actionBase = "min-h-11 rounded-[10px] border-[1.5px] px-1 text-[13px] font-semibold disabled:opacity-40";
const actionClass = `${actionBase} border-line`;

export function ExerciseCard(props: ExerciseCardProps) {
  const { item, index, total, open, planning, last } = props;
  const { exercise, we, sets } = item;
  const logType = exercise.log_type;
  const done = isExerciseDone(sets);
  const checked = props.roundDone ?? done;
  const skipped = we.skipped;
  const showLast = !done && lastTimeDiffers(sets, last);
  const num = String(index + 1).padStart(2, "0");
  const technique = techniqueOf(exercise);

  const tags: { text: string; accent: boolean }[] = [];
  if (props.planWeight) tags.push({ text: props.planWeight, accent: true });
  if (item.replaced) tags.push({ text: `вместо: ${item.replaced.name}`, accent: true });
  if (item.planNote) tags.push({ text: item.planNote, accent: false });
  if (we.note) tags.push({ text: `заметка: ${we.note}`, accent: true });
  if (skipped) tags.push({ text: "пропущено", accent: false });

  return (
    <article
      id={`we-${we.id}`}
      aria-label={exercise.name}
      aria-current={props.current ? "step" : undefined}
      className={`scroll-mt-3 overflow-hidden rounded-[18px] border-ink transition-colors duration-300 ${
        props.current ? "border-[3px]" : "border-[1.5px]"
      } ${checked ? "bg-surface-done" : "bg-surface"}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={props.onToggleOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 py-3.5 pr-2 pl-3.5 text-left"
        >
          {/* A skipped exercise mutes only its text (a readable muted color): the buttons stay clearly usable. */}
          <span className="w-[26px] shrink-0 pt-0.5 font-mono text-sm font-bold text-ink-muted">{num}</span>
          <span className={`flex min-w-0 flex-col gap-1 ${skipped ? "text-ink-muted" : ""}`}>
            <span className={`text-base leading-tight font-semibold ${skipped ? "line-through decoration-1" : ""}`}>{exercise.name}</span>
            <span className="font-mono text-[15px] font-bold">{formatSetsSummary(logType, sets)}</span>
            {tags.map((t) => (
              <span key={t.text} className={`text-[13px] ${t.accent ? "text-accent-text" : "text-ink-muted"}`}>
                {t.text}
              </span>
            ))}
          </span>
          {planning && (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`mr-1.5 ml-auto shrink-0 self-center text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </button>
        {!planning && (
          <button
            type="button"
            onClick={props.onToggleDone}
            disabled={skipped || sets.length === 0}
            aria-pressed={checked}
            aria-label={`Выполнено: ${exercise.name}${we.circuit_id && !done ? " — этот круг" : ""}`}
            className="flex w-[76px] shrink-0 items-center justify-center border-l-[1.5px] border-line disabled:opacity-50"
          >
            <span
              className={`check-ring flex h-13 w-13 items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] duration-200 active:scale-90 ${
                checked ? "border-accent bg-accent text-on-accent" : "border-ink text-line-strong"
              }`}
              data-done={checked || undefined}
            >
              <CheckIcon className={checked ? "check-draw" : ""} />
            </span>
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2.5 border-t-[1.5px] border-dashed border-line px-3.5 pt-3 pb-3.5">
          {showLast && <p className="text-[13px] text-ink-muted">В прошлый раз: {formatSetsSummary(logType, last!)}</p>}
          {sets.map((s, si) => (
            <div key={s.id} className="flex flex-col gap-2">
            {!planning && s.rest_sec !== undefined && <RestLine sec={s.rest_sec} target={s.rest_target_sec} approx={!!s.rest_approx} before={si === 0 && !we.circuit_id} className="pl-[52px]" />}
            <div className="flex items-center gap-2">
              {planning ? (
                <span className="flex h-12 w-11 shrink-0 items-center justify-center font-mono text-sm font-bold text-ink-muted">{si + 1}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => props.onToggleSet(si)}
                  aria-pressed={s.done_at !== null}
                  aria-label={`Подход ${si + 1} ${s.done_at ? "выполнен" : "не выполнен"}`}
                  className={`h-12 w-11 shrink-0 rounded-[10px] border-[1.5px] border-ink font-mono text-sm font-bold transition-colors ${
                    s.done_at ? "bg-accent text-on-accent" : ""
                  }`}
                >
                  {si + 1}
                </button>
              )}
              {fieldsFor(logType).map((field) => (
                <ValueStepper
                  key={field}
                  display={display(logType, field, s[field])}
                  unit={unitOf(logType, field)}
                  changed={isFieldChanged(s, field)}
                  inputMode={field === "reps" ? "numeric" : "decimal"}
                  onStep={(dir) => props.onValue(si, field, stepValue(logType, field, s[field], dir))}
                  onType={(text) => {
                    const v = parseTyped(logType, field, text, [s.weight, ...sets.map((x) => x.weight), ...(last ?? []).map((x) => x.weight)]);
                    if (v === null) return false;
                    props.onValue(si, field, v);
                    return true;
                  }}
                />
              ))}
            </div>
            </div>
          ))}
          {/* К5 (stage 46): frequent actions in row 1 — sets together, «+ подход» rightmost under the thumb;
              rare ones in row 2 — the «Как делать» book (outlined darker, easier to spot), «Пропуск», ↑ ↓. */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button type="button" onClick={props.onReplace} className={actionClass}>
              Заменить
            </button>
            <button type="button" onClick={props.onNote} className={actionClass}>
              Заметка
            </button>
            <button type="button" onClick={props.onRemoveSet} disabled={sets.length <= 1} className={actionClass}>
              − подход
            </button>
            <button type="button" onClick={props.onAddSet} className={actionClass}>
              + подход
            </button>
          </div>
          <div className={`grid gap-1.5 ${technique ? "grid-cols-[52px_minmax(0,1fr)_52px_52px]" : "grid-cols-[minmax(0,1fr)_52px_52px]"}`}>
            {technique && (
              <button type="button" onClick={props.onTechnique} aria-label="Как делать" className={`${actionBase} flex items-center justify-center border-ink`}>
                <BookIcon />
              </button>
            )}
            <button type="button" onClick={props.onSkip} className={`${actionBase} ${skipped ? "border-ink" : "border-line"}`}>
              {skipped ? "Вернуть" : "Пропуск"}
            </button>
            <button type="button" onClick={() => props.onMove(-1)} disabled={index === 0} className={`${actionClass} flex items-center justify-center`} aria-label="Переместить выше">
              <ArrowIcon up />
            </button>
            <button type="button" onClick={() => props.onMove(1)} disabled={index === total - 1} className={`${actionClass} flex items-center justify-center`} aria-label="Переместить ниже">
              <ArrowIcon />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
