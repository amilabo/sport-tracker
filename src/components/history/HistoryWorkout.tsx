"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Scale5 } from "@/components/ui/Scale5";
import { Sheet } from "@/components/ui/Sheet";
import { DateField, TimeField } from "@/components/ui/TimeField";
import { useLive } from "@/db/hooks";
import { workoutsRepo, type WorkoutFull } from "@/db/repos/workouts";
import { touch } from "@/domain/entity";
import { formatHeaderDate, formatShortDate, formatTime } from "@/domain/format";
import { fieldText, formatSetDetail, parseField } from "@/domain/history";
import { durationMinutes, formatDurationLong, formatKg, summarize } from "@/domain/summary";
import { isWorkoutDate, parseTime24, toLocalDate, workoutMoments } from "@/domain/time";
import type { Exercise, Id, LogType, SetValues, Workout, WorkoutExercise, WorkoutSet } from "@/domain/types";
import { addedExercise, fieldsFor, newWorkoutSet, type SetField } from "@/domain/workout";

export function HistoryWorkoutRoute() {
  const id = useSearchParams().get("id");
  if (!id) return <Missing text="Не выбрана тренировка." />;
  return <Loader key={id} id={id} />;
}

function Missing({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader title="Тренировка" backHref="/history/" />
      <p className="px-4 text-[15px]">{text}</p>
      <div className="px-4">
        <ButtonLink href="/history/" variant="primary">
          К истории
        </ButtonLink>
      </div>
    </div>
  );
}

function Loader({ id }: { id: Id }) {
  const { data, loading } = useLive(
    async () => (await workoutsRepo.getFull(id)) ?? null,
    [id],
    ["workouts", "workout_exercises", "workout_sets", "plans", "exercises"],
  );
  if (loading && data === undefined) return null;
  if (!data) return <Missing text="Тренировка не найдена — возможно, её удалили." />;
  if (data.workout.status === "in_progress") {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <PageHeader title="Тренировка" backHref="/history/" />
        <p className="px-4 text-[15px]">Эта тренировка ещё идёт.</p>
        <div className="px-4">
          <ButtonLink href={`/workout/?id=${id}`} variant="primary">
            Продолжить
          </ButtonLink>
        </div>
      </div>
    );
  }
  return <HistoryWorkout full={data} />;
}

// ---------- Edit draft ----------

interface SetDraft {
  set: WorkoutSet;
  /** Added during this edit: not in the database yet. */
  isNew: boolean;
  fields: Partial<Record<SetField, string>>;
  done: boolean;
}

interface ItemDraft {
  we: WorkoutExercise;
  exercise: Exercise;
  replaced: Exercise | null;
  isNew: boolean;
  sets: SetDraft[];
}

interface Draft {
  /** "YYYY-MM-DD" */
  date: string;
  start: string;
  end: string;
  note: string;
  wellbeingBefore: number | null;
  moodBefore: number | null;
  energyAfter: number | null;
  moodAfter: number | null;
  items: ItemDraft[];
  /** Records from the database removed in this edit; deleted only on «Сохранить». */
  removedExercises: Id[];
  removedSets: Id[];
}

function setDraftOf(logType: LogType, set: WorkoutSet, isNew: boolean, done: boolean): SetDraft {
  const fields: Partial<Record<SetField, string>> = {};
  for (const f of fieldsFor(logType)) fields[f] = fieldText(f, set[f]);
  return { set, isNew, fields, done };
}

function makeDraft(full: WorkoutFull): Draft {
  const { workout } = full;
  return {
    date: toLocalDate(new Date(workout.started_at)),
    start: formatTime(workout.started_at),
    end: workout.finished_at ? formatTime(workout.finished_at) : "",
    note: workout.note ?? "",
    wellbeingBefore: workout.wellbeing_before,
    moodBefore: workout.mood_before,
    energyAfter: workout.energy_after,
    moodAfter: workout.mood_after,
    items: full.items.map((item) => ({
      we: item.we,
      exercise: item.exercise,
      replaced: item.replaced,
      isNew: false,
      sets: item.sets.map((s) => setDraftOf(item.exercise.log_type, s, false, s.done_at !== null)),
    })),
    removedExercises: [],
    removedSets: [],
  };
}

const EMPTY_VALUES: SetValues = { weight: null, reps: null, duration_sec: null, speed_kmh: null };
const actionClass = "min-h-11 rounded-[10px] border-[1.5px] border-line px-1 text-[13px] font-semibold disabled:opacity-40";

const UNIT: Record<SetField, (logType: LogType) => string> = {
  weight: () => "кг",
  reps: () => "раз",
  duration_sec: (t) => (t === "cardio" ? "мин" : "м:сс"),
  speed_kmh: () => "км/ч",
};

// ---------- Card ----------

function HistoryWorkout({ full }: { full: WorkoutFull }) {
  const router = useRouter();
  const { workout, plan, items } = full;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState(false);

  const summary = useMemo(() => summarize(items), [items]);
  const started = new Date(workout.started_at);
  const minutes = workout.finished_at ? durationMinutes(workout.started_at, workout.finished_at) : null;
  const title = plan?.name ?? "Без плана";

  function startEdit() {
    setDraft(makeDraft(full));
    setInvalid(new Set());
    setError(null);
  }

  function updateItem(index: number, fn: (item: ItemDraft, d: Draft) => Partial<Draft> & { item?: ItemDraft | null }) {
    setDraft((d) => {
      if (!d) return d;
      const { item, ...rest } = fn(d.items[index], d);
      const list = item === undefined ? d.items : item === null ? d.items.filter((_, i) => i !== index) : d.items.map((x, i) => (i === index ? item : x));
      return { ...d, ...rest, items: list };
    });
  }

  function updateSet(index: number, setIndex: number, patch: Partial<SetDraft>) {
    updateItem(index, (item) => ({ item: { ...item, sets: item.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) } }));
  }

  function setField(index: number, setIndex: number, set: SetDraft, field: SetField, value: string) {
    updateSet(index, setIndex, { fields: { ...set.fields, [field]: value } });
    setInvalid((prev) => {
      if (!prev.has(`${set.set.id}:${field}`)) return prev;
      const next = new Set(prev);
      next.delete(`${set.set.id}:${field}`);
      return next;
    });
  }

  /** A set added afterwards goes last, as a copy of the previous one, and counts as done: it is a record of what was done. */
  function addSet(index: number) {
    updateItem(index, (item) => {
      const prev = item.sets.at(-1);
      const set = newWorkoutSet(item.we.id, item.sets.length, EMPTY_VALUES);
      const added: SetDraft = { set, isNew: true, fields: prev ? { ...prev.fields } : setDraftOf(item.exercise.log_type, set, true, true).fields, done: true };
      return { item: { ...item, sets: [...item.sets, added] } };
    });
  }

  function removeLastSet(index: number) {
    updateItem(index, (item, d) => {
      const last = item.sets.at(-1);
      if (!last || item.sets.length <= 1) return {};
      return {
        item: { ...item, sets: item.sets.slice(0, -1) },
        removedSets: last.isNew ? d.removedSets : [...d.removedSets, last.set.id],
      };
    });
  }

  function removeExercise(index: number) {
    updateItem(index, (item, d) => ({
      item: null,
      removedExercises: item.isNew ? d.removedExercises : [...d.removedExercises, item.we.id],
    }));
  }

  /** Added exercise: sets from the latest other workout with it (to correct), or one empty set; all done. */
  async function addExercise(exercise: Exercise) {
    const last = (await workoutsRepo.lastSetsByExercise([exercise.id], workout.id)).get(exercise.id);
    const added = addedExercise(workout.id, exercise.id, 0, last);
    const item: ItemDraft = {
      we: added.we,
      exercise,
      replaced: null,
      isNew: true,
      sets: added.sets.map((s) => setDraftOf(exercise.log_type, s, true, true)),
    };
    setDraft((d) => d && { ...d, items: [...d.items, item] });
  }

  async function save() {
    if (!draft) return;
    setError(null);
    const bad = new Set<string>();
    const changedExercises: WorkoutExercise[] = [];
    const changedSets: WorkoutSet[] = [];
    const times = workoutMoments(draft.date, draft.start, draft.end);
    const doneFallback = times.end?.toISOString() ?? workout.finished_at ?? workout.started_at;

    draft.items.forEach((item, position) => {
      if (item.isNew) changedExercises.push({ ...item.we, position });
      else if (item.we.position !== position) changedExercises.push(touch(item.we, { position }));
      const logType = item.exercise.log_type;
      item.sets.forEach((d, setPosition) => {
        const s = d.set;
        const patch: Partial<WorkoutSet> = {};
        for (const f of fieldsFor(logType)) {
          const v = parseField(logType, f, d.fields[f] ?? "", [s.weight, ...item.sets.map((x) => x.set.weight)]);
          if (v === undefined) bad.add(`${s.id}:${f}`);
          else if (d.isNew || v !== s[f]) patch[f] = v;
        }
        if (d.isNew || d.done !== (s.done_at !== null)) patch.done_at = d.done ? doneFallback : null;
        if (s.position !== setPosition) patch.position = setPosition;
        if (d.isNew) changedSets.push({ ...s, ...patch });
        else if (Object.keys(patch).length) changedSets.push(touch(s, patch));
      });
    });

    if (!isWorkoutDate(draft.date)) bad.add("date");
    if (!parseTime24(draft.start)) bad.add("start");
    if (!parseTime24(draft.end)) bad.add("end");
    setInvalid(bad);
    if (bad.size) return setError("Проверьте выделенные значения");
    const mins = durationMinutes(times.start!.toISOString(), times.end!.toISOString());
    if (mins > 12 * 60) return setError("Тренировка дольше 12 часов? Проверьте время начала и конца");

    const nextWorkout = {
      started_at: times.start!.toISOString(),
      finished_at: times.end!.toISOString(),
      note: draft.note.trim() || null,
      wellbeing_before: draft.wellbeingBefore,
      mood_before: draft.moodBefore,
      energy_after: draft.energyAfter,
      mood_after: draft.moodAfter,
    };
    const workoutChanged = (Object.keys(nextWorkout) as (keyof typeof nextWorkout)[]).some((k) => nextWorkout[k] !== workout[k]);

    setBusy(true);
    try {
      const structureChanged = changedExercises.length || changedSets.length || draft.removedExercises.length || draft.removedSets.length;
      if (workoutChanged || structureChanged) {
        await workoutsRepo.put({
          workout: workoutChanged ? touch(workout, nextWorkout) : undefined,
          exercises: changedExercises,
          sets: changedSets,
          deleteSetIds: draft.removedSets,
          deleteExerciseIds: draft.removedExercises,
        });
      }
      setDraft(null);
    } catch (err) {
      console.error(err);
      setError("Не получилось сохранить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await workoutsRepo.remove(workout.id);
      router.replace("/history/");
    } catch (err) {
      console.error(err);
      setConfirmDelete(false);
      setError("Не получилось удалить. Попробуйте ещё раз.");
      setBusy(false);
    }
  }

  const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";
  // Two columns filled row by row: «до» on the left, «после» on the right.
  const ratings: [string, number | null][] = [
    ["Самочувствие до", workout.wellbeing_before],
    ["Силы после", workout.energy_after],
    ["Настроение до", workout.mood_before],
    ["Настроение после", workout.mood_after],
  ];
  const hasRatings = ratings.some(([, v]) => v !== null);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={draft ? "Правка тренировки" : "Тренировка"}
        backHref="/history/"
        action={
          !draft && (
            <Button variant="primary" onClick={startEdit}>
              Изменить
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3.5 px-4 pb-8">
        <section className="flex flex-col gap-2 rounded-[22px] bg-surface-inverse p-4 text-on-inverse">
          <span className="font-mono text-[13px] tracking-[0.08em] text-accent uppercase">{formatHeaderDate(started)}</span>
          <h1 className="font-display text-[26px] leading-[1.05] font-extrabold tracking-[-0.02em]">{title}</h1>
          <span className="font-mono text-[13px] text-on-inverse-muted">
            {formatTime(started)}
            {workout.finished_at && `–${formatTime(workout.finished_at)}`}
            {minutes !== null && ` · ${formatDurationLong(minutes)}`}
          </span>
          {workout.status === "auto_finished" && <span className="text-[13px] text-on-inverse-muted">Завершена автоматически</span>}
        </section>

        {!draft && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                <span className="text-xs text-ink-muted">Выполнено</span>
                <span className="font-display text-[26px] leading-none font-extrabold">{summary.percent}%</span>
                <span className="text-xs text-ink-muted">
                  {summary.doneSets} из {summary.totalSets} подходов
                </span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                <span className="text-xs text-ink-muted">Объём</span>
                <span className="font-display text-[26px] leading-none font-extrabold">{formatKg(summary.volumeKg)}</span>
                <span className="text-xs text-ink-muted">кг · вес × раз</span>
              </div>
            </div>

            {hasRatings && (
              <section className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                {ratings.map(([label, v]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-ink-muted">{label}</span>
                    <span className="font-mono text-[15px] font-bold">{v ?? "—"}</span>
                  </div>
                ))}
              </section>
            )}

            {workout.note && (
              <section className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                <span className="text-xs text-ink-muted">Заметка</span>
                <p className="text-[15px] leading-snug whitespace-pre-wrap">{workout.note}</p>
              </section>
            )}
          </>
        )}

        {draft && (
          <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <DateField label="Дата" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} invalid={invalid.has("date")} />
              </div>
              <TimeField label="Начало" value={draft.start} onChange={(v) => setDraft({ ...draft, start: v })} invalid={invalid.has("start")} />
              <TimeField label="Конец" value={draft.end} onChange={(v) => setDraft({ ...draft, end: v })} invalid={invalid.has("end")} />
            </div>
            <Scale5 label="Самочувствие до" value={draft.wellbeingBefore} onChange={(v) => setDraft({ ...draft, wellbeingBefore: v })} />
            <Scale5 label="Настроение до" value={draft.moodBefore} onChange={(v) => setDraft({ ...draft, moodBefore: v })} />
            <Scale5 label="Силы после" value={draft.energyAfter} onChange={(v) => setDraft({ ...draft, energyAfter: v })} />
            <Scale5 label="Настроение после" value={draft.moodAfter} onChange={(v) => setDraft({ ...draft, moodAfter: v })} />
            <Field label="Заметка к тренировке" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </section>
        )}

        <h2 className={`${sectionTitle} mt-1`}>Упражнения</h2>
        {!draft &&
          items.map((item) => {
            const logType = item.exercise.log_type;
            return (
              <article key={item.we.id} className={`flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-3.5 ${item.we.skipped ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-0.5">
                  <Link href={`/exercises/view/?id=${item.exercise.id}`} className="text-base leading-tight font-semibold underline-offset-2 hover:underline">
                    {item.exercise.name}
                  </Link>
                  {item.replaced && <span className="text-[13px] text-ink-muted">вместо: {item.replaced.name}</span>}
                  {item.we.skipped && <span className="text-[13px] text-accent-text">пропущено</span>}
                  {item.we.note && <span className="text-[13px] text-ink-muted">{item.we.note}</span>}
                </div>
                <ol className="flex flex-col">
                  {item.sets.map((s, i) => (
                    <li key={s.id} className="flex items-baseline gap-3 border-t border-line py-1.5 first:border-t-0">
                      <span className="w-5 font-mono text-[13px] text-ink-muted">{i + 1}</span>
                      <span className={`font-mono text-[15px] font-bold ${s.done_at ? "" : "text-ink-muted"}`}>{formatSetDetail(logType, s)}</span>
                      {!s.done_at && <span className="ml-auto text-[13px] text-ink-muted">не выполнен</span>}
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        {!draft && !items.length && <p className="text-[15px] text-ink-muted">Упражнений нет.</p>}

        {draft &&
          draft.items.map((item, index) => {
            const logType = item.exercise.log_type;
            const name = item.exercise.name;
            return (
              <article key={item.we.id} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base leading-tight font-semibold">{name}</span>
                  {item.replaced && <span className="text-[13px] text-ink-muted">вместо: {item.replaced.name}</span>}
                </div>
                <ol className="flex flex-col gap-2">
                  {item.sets.map((d, i) => {
                    const s = d.set;
                    return (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="w-5 font-mono text-[13px] text-ink-muted">{i + 1}</span>
                        {fieldsFor(logType).map((f) => (
                          <label key={f} className="flex min-w-0 flex-1 items-center gap-1">
                            <input
                              value={d.fields[f] ?? ""}
                              onChange={(e) => setField(index, i, d, f, e.target.value)}
                              inputMode={f === "reps" ? "numeric" : f === "duration_sec" ? "text" : "decimal"}
                              aria-label={`${name}, подход ${i + 1}: ${UNIT[f](logType)}`}
                              aria-invalid={invalid.has(`${s.id}:${f}`) || undefined}
                              className={`h-11 w-full min-w-0 rounded-[10px] border-[1.5px] bg-bg px-2 text-center font-mono text-[15px] font-bold ${
                                invalid.has(`${s.id}:${f}`) ? "border-accent-text" : "border-line-strong"
                              }`}
                            />
                            <span className="shrink-0 text-xs text-ink-muted">{UNIT[f](logType)}</span>
                          </label>
                        ))}
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={d.done}
                          aria-label={`${name}, подход ${i + 1} выполнен`}
                          onClick={() => updateSet(index, i, { done: !d.done })}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] ${
                            d.done ? "border-ink bg-surface-inverse text-on-inverse" : "border-line-strong text-ink-muted"
                          }`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button type="button" onClick={() => addSet(index)} className={actionClass} aria-label={`${name}: добавить подход`}>
                    + подход
                  </button>
                  <button type="button" onClick={() => removeLastSet(index)} disabled={item.sets.length <= 1} className={actionClass} aria-label={`${name}: убрать последний подход`}>
                    − подход
                  </button>
                  <button type="button" onClick={() => removeExercise(index)} className={actionClass} aria-label={`Убрать упражнение «${name}»`}>
                    Убрать
                  </button>
                </div>
              </article>
            );
          })}
        {draft && (
          <Button variant="ghost" size="lg" onClick={() => setPicking(true)}>
            + Добавить упражнение
          </Button>
        )}

        <FormError message={error} />

        {draft ? (
          <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-bg px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              disabled={busy}
            >
              Отмена
            </Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              Сохранить
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-2 w-full" onClick={() => setConfirmDelete(true)}>
            Удалить тренировку
          </Button>
        )}
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={async (e) => {
          setPicking(false);
          await addExercise(e);
        }}
      />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить тренировку?"
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="accent" onClick={remove} disabled={busy}>
              Удалить
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Отмена
            </Button>
          </div>
        }
      >
        <p className="text-[15px] leading-snug">
          Тренировка {formatShortDate(started)} «{title}» будет удалена из истории вместе со всеми подходами. Отменить это нельзя.
        </p>
      </Sheet>
    </div>
  );
}
