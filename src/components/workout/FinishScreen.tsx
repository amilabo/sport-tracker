"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Scale5 } from "@/components/ui/Scale5";
import { DateField, TimeField } from "@/components/ui/TimeField";
import { plansRepo } from "@/db/repos/plans";
import { workoutsRepo, type WorkoutFull } from "@/db/repos/workouts";
import { formatHeaderDate, formatShortDate, formatTime } from "@/domain/format";
import { planChanges, type PlanChange } from "@/domain/plan-diff";
import { formatRest } from "@/domain/rest";
import { restSummary, restUpdates } from "@/domain/rest-summary";
import { durationMinutes, formatDuration, formatDurationLong, formatKg, summarize } from "@/domain/summary";
import { isWorkoutDate, parseTime24, toLocalDate, workoutMoments } from "@/domain/time";
import { DomainError, type Id } from "@/domain/types";
import { rememberSaved } from "@/components/home/SavedWorkout";
import { PlanUpdateList } from "./PlanUpdateList";
import { WorkRest } from "./WorkRest";

export function FinishRoute() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-5">
        <p className="text-[15px]">Не выбрана тренировка.</p>
        <ButtonLink href="/" variant="primary">
          К планам
        </ButtonLink>
      </div>
    );
  }
  return <FinishLoader key={id} id={id} />;
}

function FinishLoader({ id }: { id: Id }) {
  const [full, setFull] = useState<WorkoutFull | null | "missing">(null);
  useEffect(() => {
    let alive = true;
    workoutsRepo.getFull(id).then((f) => alive && setFull(f ?? "missing"));
    return () => {
      alive = false;
    };
  }, [id]);

  if (full === "missing") return <p className="p-5 text-[15px]">Тренировка не найдена.</p>;
  if (!full) return null;
  if (full.workout.status !== "in_progress") {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-5">
        <p className="text-[15px]">Эта тренировка уже сохранена в истории.</p>
        <ButtonLink href="/" variant="primary">
          К планам
        </ButtonLink>
      </div>
    );
  }
  return <FinishForm full={full} />;
}

function FinishForm({ full }: { full: WorkoutFull }) {
  const router = useRouter();
  const { workout, plan, items } = full;
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [afterHidden, setAfterHidden] = useState(false);
  const [date, setDate] = useState(() => toLocalDate(new Date(workout.started_at)));
  const [start, setStart] = useState(() => formatTime(workout.started_at));
  const [end, setEnd] = useState(() => formatTime(new Date().toISOString()));
  const [note, setNote] = useState(workout.note ?? "");
  const [decision, setDecision] = useState<PlanChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [planName, setPlanName] = useState(() => `Тренировка ${formatShortDate(workout.started_at).split(", ")[1]}`);
  const [savedPlan, setSavedPlan] = useState<string | null>(null);

  const summary = useMemo(() => summarize(items), [items]);
  const changes = useMemo((): PlanChange[] => {
    if (!plan || plan.archived_at) return [];
    // Rest between sets measured on the timer (stage 37) goes into the same list as weights.
    const rest = restUpdates(items, workout.rest).map((u) => ({
      key: u.key,
      exerciseName: u.exerciseName,
      where: "отдых между подходами",
      from: formatRest(u.fromSec),
      to: formatRest(u.toSec),
      updates: [],
      rest: { planExerciseId: u.planExerciseId, sec: u.toSec },
    }));
    return [...planChanges(items), ...rest];
  }, [plan, items, workout.rest]);
  const rest = useMemo(() => restSummary(items), [items]);

  // Date and times: an entry made later can move the workout to the day it happened.
  const dateOk = isWorkoutDate(date);
  const { start: startDate, end: endDate } = workoutMoments(date, start, end);
  const minutes = startDate && endDate ? durationMinutes(startDate.toISOString(), endDate.toISOString()) : null;

  async function save() {
    setError(null);
    if (!dateOk) return setError("Проверьте дату: не позже сегодня");
    if (!startDate || !endDate || minutes === null) return setError("Проверьте время начала и конца");
    if (minutes > 12 * 60) return setError("Тренировка дольше 12 часов? Проверьте время начала и конца");
    setBusy(true);
    try {
      if (decision?.length) {
        await plansRepo.applySetUpdates(decision.flatMap((c) => c.updates));
        await plansRepo.applyRestUpdates(decision.flatMap((c) => (c.rest ? [c.rest] : [])));
      }
      await workoutsRepo.complete(workout.id, {
        started_at: startDate.toISOString(),
        finished_at: endDate.toISOString(),
        energy_after: afterHidden ? null : energy,
        mood_after: afterHidden ? null : mood,
        note: note.trim() || null,
      });
      rememberSaved({
        title: plan?.name ?? "Без плана",
        percent: summary.percent,
        volumeKg: summary.volumeKg,
        duration: minutes !== null ? formatDurationLong(minutes) : null,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
      if (!(err instanceof DomainError)) console.error(err);
      setBusy(false);
    }
  }

  async function saveAsPlan() {
    setError(null);
    try {
      await plansRepo.save({
        name: planName,
        items: items
          .filter((i) => !i.we.skipped && i.sets.length)
          .map((i) => ({
            exercise_id: i.exercise.id,
            note: i.we.note,
            sets: i.sets.map(({ weight, reps, duration_sec, speed_kmh }) => ({ weight, reps, duration_sec, speed_kmh })),
          })),
      });
      setSavedPlan(planName.trim());
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить план.");
    }
  }

  const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-2 bg-surface-inverse px-5 pt-7 pb-6 text-on-inverse">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[13px] tracking-[0.08em] text-accent-on-inverse uppercase">Готово · {formatHeaderDate(startDate ?? new Date(workout.started_at))}</span>
          <Link href={`/workout/?id=${workout.id}`} className="min-h-11 content-center text-[13px] text-on-inverse-muted underline">
            К тренировке
          </Link>
        </div>
        <h1 className="font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em]">{plan?.name ?? "Тренировка без плана"}</h1>
      </header>

      <div className="flex flex-col gap-3.5 p-4 pb-8">
        {!afterHidden && (
          <section className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface p-3.5">
            <div className="flex items-center justify-between">
              <h2 className={sectionTitle}>После тренировки</h2>
              <button type="button" onClick={() => setAfterHidden(true)} className="min-h-11 px-1 text-[13px] text-ink-muted underline">
                Пропустить
              </button>
            </div>
            <Scale5 label="Силы" value={energy} onChange={setEnergy} />
            <Scale5 label="Настроение" value={mood} onChange={setMood} />
          </section>
        )}

        {changes.length > 0 && plan && (
          <section className={`flex flex-col gap-3 rounded-[18px] border-2 bg-surface p-3.5 ${decision === null ? "border-accent-line" : "border-line"}`}>
            <h2 className="font-display text-[17px] leading-tight font-bold">
              {changes.some((c) => c.rest) ? "Обновить план?" : "Обновить веса в плане?"}
            </h2>
            {decision === null ? (
              <PlanUpdateList planName={plan.name} changes={changes} onDecide={setDecision} />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px]">
                  {decision.length ? `В план перенесётся: ${decision.length}` : "План остаётся как был"}
                </p>
                <button type="button" onClick={() => setDecision(null)} className="min-h-11 px-1 text-[13px] text-ink-muted underline">
                  Изменить
                </button>
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className={sectionTitle}>Сводка</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-inverse p-3.5 text-on-inverse">
              <span className="text-xs text-on-inverse-muted">Выполнено</span>
              <span className="font-display text-[30px] leading-none font-extrabold text-accent-on-inverse">{summary.percent}%</span>
              <span className="text-xs text-on-inverse-muted">
                {summary.doneSets} из {summary.totalSets} подходов
              </span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
              <span className="text-xs text-ink-muted">Объём</span>
              <span className="font-display text-[30px] leading-none font-extrabold">{formatKg(summary.volumeKg)}</span>
              <span className="text-xs text-ink-muted">кг · вес × раз</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-ink-muted">Длительность</span>
              <span className="font-display text-[22px] font-extrabold">{minutes === null ? "—" : formatDuration(minutes)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <DateField label="Дата" value={date} onChange={setDate} invalid={!dateOk} />
              </div>
              <TimeField label="Начало" value={start} onChange={setStart} invalid={!parseTime24(start)} />
              <TimeField label="Конец" value={end} onChange={setEnd} invalid={!parseTime24(end)} />
            </div>
          </div>
          {rest && <WorkRest rest={rest} minutes={minutes} />}
          {(summary.notDone.length > 0 || summary.replacements.length > 0) && (
            <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface px-3.5 py-3">
              {summary.notDone.length > 0 && (
                <>
                  <span className="text-xs text-ink-muted">Не выполнено</span>
                  {summary.notDone.map((t) => (
                    <span key={t} className="text-sm">
                      {t}
                    </span>
                  ))}
                </>
              )}
              {summary.replacements.map((t) => (
                <span key={t} className="text-xs text-ink-muted">
                  Замена: {t}
                </span>
              ))}
            </div>
          )}
        </section>

        <Field label="Заметка к тренировке" value={note} onChange={(e) => setNote(e.target.value)} placeholder="как прошло, что учесть в следующий раз" />

        {!plan && items.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-ink bg-surface p-3.5">
            <h2 className={sectionTitle}>Сохранить как план</h2>
            {savedPlan ? (
              <p className="text-[15px]">План «{savedPlan}» сохранён — он появится на главной.</p>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Название плана" value={planName} onChange={(e) => setPlanName(e.target.value)} />
                </div>
                <Button variant="outline" onClick={saveAsPlan}>
                  Сохранить
                </Button>
              </div>
            )}
          </section>
        )}

        <FormError message={error} />
        <Button variant="accent" size="xl" className="mt-1 w-full" onClick={save} disabled={busy}>
          Сохранить в историю
        </Button>
      </div>
    </div>
  );
}
