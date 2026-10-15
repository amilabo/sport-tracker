"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Scale5 } from "@/components/ui/Scale5";
import { Sheet } from "@/components/ui/Sheet";
import { parseTime24, TimeField } from "@/components/ui/TimeField";
import { useLive } from "@/db/hooks";
import { workoutsRepo, type WorkoutFull } from "@/db/repos/workouts";
import { touch } from "@/domain/entity";
import { formatHeaderDate, formatShortDate, formatTime } from "@/domain/format";
import { fieldText, formatSetDetail, parseField } from "@/domain/history";
import { durationMinutes, formatDurationLong, formatKg, summarize } from "@/domain/summary";
import type { Id, LogType, Workout, WorkoutSet } from "@/domain/types";
import { fieldsFor, type SetField } from "@/domain/workout";

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
  fields: Partial<Record<SetField, string>>;
  done: boolean;
}

interface Draft {
  start: string;
  end: string;
  note: string;
  wellbeingBefore: number | null;
  moodBefore: number | null;
  energyAfter: number | null;
  moodAfter: number | null;
  sets: Record<Id, SetDraft>;
}

function makeDraft(full: WorkoutFull): Draft {
  const { workout } = full;
  const sets: Record<Id, SetDraft> = {};
  for (const item of full.items) {
    for (const s of item.sets) {
      const fields: Partial<Record<SetField, string>> = {};
      for (const f of fieldsFor(item.exercise.log_type)) fields[f] = fieldText(f, s[f]);
      sets[s.id] = { fields, done: s.done_at !== null };
    }
  }
  return {
    start: formatTime(workout.started_at),
    end: workout.finished_at ? formatTime(workout.finished_at) : "",
    note: workout.note ?? "",
    wellbeingBefore: workout.wellbeing_before,
    moodBefore: workout.mood_before,
    energyAfter: workout.energy_after,
    moodAfter: workout.mood_after,
    sets,
  };
}

/** The moment "HH:MM" on the workout's start date; an end before the start crossed midnight. */
function timesOf(workout: Workout, start: string, end: string) {
  const at = (hhmm: string) => {
    const t = parseTime24(hhmm);
    if (!t) return null;
    const d = new Date(workout.started_at);
    d.setHours(t.h, t.m, 0, 0);
    return d;
  };
  const s = at(start);
  let e = at(end);
  if (s && e && e < s) e = new Date(e.getTime() + 24 * 3600 * 1000);
  return { start: s, end: e };
}

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

  const summary = useMemo(() => summarize(items), [items]);
  const started = new Date(workout.started_at);
  const minutes = workout.finished_at ? durationMinutes(workout.started_at, workout.finished_at) : null;
  const title = plan?.name ?? "Без плана";

  function startEdit() {
    setDraft(makeDraft(full));
    setInvalid(new Set());
    setError(null);
  }

  function setField(setId: Id, field: SetField, value: string) {
    setDraft((d) => d && { ...d, sets: { ...d.sets, [setId]: { ...d.sets[setId], fields: { ...d.sets[setId].fields, [field]: value } } } });
    setInvalid((prev) => {
      if (!prev.has(`${setId}:${field}`)) return prev;
      const next = new Set(prev);
      next.delete(`${setId}:${field}`);
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    setError(null);
    const bad = new Set<string>();
    const changedSets: WorkoutSet[] = [];
    const doneFallback = workout.finished_at ?? workout.started_at;

    for (const item of items) {
      const logType = item.exercise.log_type;
      for (const s of item.sets) {
        const d = draft.sets[s.id];
        const patch: Partial<WorkoutSet> = {};
        for (const f of fieldsFor(logType)) {
          const v = parseField(logType, f, d.fields[f] ?? "");
          if (v === undefined) bad.add(`${s.id}:${f}`);
          else if (v !== s[f]) patch[f] = v;
        }
        if (d.done !== (s.done_at !== null)) patch.done_at = d.done ? doneFallback : null;
        if (Object.keys(patch).length) changedSets.push(touch(s, patch));
      }
    }

    const times = timesOf(workout, draft.start, draft.end);
    if (!times.start) bad.add("start");
    if (!times.end) bad.add("end");
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
      if (workoutChanged || changedSets.length) {
        await workoutsRepo.put({ workout: workoutChanged ? touch(workout, nextWorkout) : undefined, sets: changedSets });
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
  const ratings: [string, number | null][] = [
    ["Самочувствие до", workout.wellbeing_before],
    ["Настроение до", workout.mood_before],
    ["Силы после", workout.energy_after],
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
        {items.map((item) => {
          const logType = item.exercise.log_type;
          return (
            <article key={item.we.id} className={`flex flex-col gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-3.5 ${item.we.skipped && !draft ? "opacity-60" : ""}`}>
              <div className="flex flex-col gap-0.5">
                <Link href={`/exercises/view/?id=${item.exercise.id}`} className="text-base leading-tight font-semibold underline-offset-2 hover:underline">
                  {item.exercise.name}
                </Link>
                {item.replaced && <span className="text-[13px] text-ink-muted">вместо: {item.replaced.name}</span>}
                {item.we.skipped && <span className="text-[13px] text-accent-text">пропущено</span>}
                {item.we.note && <span className="text-[13px] text-ink-muted">{item.we.note}</span>}
              </div>

              {!draft && (
                <ol className="flex flex-col">
                  {item.sets.map((s, i) => (
                    <li key={s.id} className="flex items-baseline gap-3 border-t border-line py-1.5 first:border-t-0">
                      <span className="w-5 font-mono text-[13px] text-ink-muted">{i + 1}</span>
                      <span className={`font-mono text-[15px] font-bold ${s.done_at ? "" : "text-ink-muted"}`}>{formatSetDetail(logType, s)}</span>
                      {!s.done_at && <span className="ml-auto text-[13px] text-ink-muted">не выполнен</span>}
                    </li>
                  ))}
                </ol>
              )}

              {draft && (
                <ol className="flex flex-col gap-2">
                  {item.sets.map((s, i) => {
                    const d = draft.sets[s.id];
                    return (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="w-5 font-mono text-[13px] text-ink-muted">{i + 1}</span>
                        {fieldsFor(logType).map((f) => (
                          <label key={f} className="flex min-w-0 flex-1 items-center gap-1">
                            <input
                              value={d.fields[f] ?? ""}
                              onChange={(e) => setField(s.id, f, e.target.value)}
                              inputMode={f === "reps" ? "numeric" : f === "duration_sec" ? "text" : "decimal"}
                              aria-label={`Подход ${i + 1}: ${UNIT[f](logType)}`}
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
                          aria-label={`Подход ${i + 1} выполнен`}
                          onClick={() => setDraft({ ...draft, sets: { ...draft.sets, [s.id]: { ...d, done: !d.done } } })}
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
              )}
            </article>
          );
        })}

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
