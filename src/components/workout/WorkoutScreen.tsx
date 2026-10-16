"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Scale5 } from "@/components/ui/Scale5";
import { Sheet } from "@/components/ui/Sheet";
import { workoutsRepo } from "@/db/repos/workouts";
import { EXERCISE_FORMS, formatTime, plural } from "@/domain/format";
import type { Id, Workout } from "@/domain/types";
import { progress } from "@/domain/workout";
import { ExerciseCard } from "./ExerciseCard";
import { StartConflictSheet } from "./StartConflictSheet";
import { useWorkoutSession } from "./useWorkoutSession";

/**
 * /workout/?id=… — a workout; /workout/?plan=… — the plan's workout before "Начать";
 * without either — the workout in progress, if any.
 */
export function WorkoutRoute() {
  const params = useSearchParams();
  const id = params.get("id");
  const planId = params.get("plan");
  const router = useRouter();
  const [activeId, setActiveId] = useState<Id | null | "none">(null);

  useEffect(() => {
    if (id || planId) return;
    workoutsRepo.getActive().then((w) => {
      if (w) router.replace(`/workout/?id=${w.id}`);
      else setActiveId("none");
    });
  }, [id, planId, router]);

  if (id) return <WorkoutScreen key={id} kind="workout" targetId={id} />;
  if (planId) return <WorkoutScreen key={`plan-${planId}`} kind="draft" targetId={planId} />;
  if (activeId === "none") {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-5">
        <p className="text-[15px]">Сейчас нет начатой тренировки.</p>
        <ButtonLink href="/" variant="primary">
          К планам
        </ButtonLink>
      </div>
    );
  }
  return null;
}

/** Re-renders every 15 s: enough for "идёт 00:41". */
function useMinuteClock() {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 15000);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 15000),
    () => 0,
  );
}

function elapsed(fromIso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000));
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function clock(d: Date) {
  // Explicit 24-hour "ЧЧ:ММ:СС", independent of the phone's locale settings.
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

type Picker = { kind: "add" } | { kind: "replace"; index: number } | null;

function WorkoutScreen({ kind, targetId }: { kind: "workout" | "draft"; targetId: Id }) {
  const router = useRouter();
  const { full, last, savedAt, saveFailed, dirty, isDraft, actions } = useWorkoutSession(kind, targetId);
  const [open, setOpen] = useState<Id | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [beforeHidden, setBeforeHidden] = useState(false);
  const [starting, setStarting] = useState(false);
  const [conflict, setConflict] = useState<Workout | null>(null);
  /** Leaving a draft with changes: where to, once confirmed. */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  useMinuteClock();

  /** Draft → a stored workout in progress, with today's changes and the start time = now. */
  async function begin() {
    if (starting) return;
    setStarting(true);
    try {
      const r = await actions.start();
      if (r?.status === "started") router.replace(`/workout/?id=${r.id}`);
      else if (r?.status === "conflict") setConflict(r.active);
    } finally {
      setStarting(false);
    }
  }

  async function finishActiveAndBegin() {
    if (!conflict) return;
    const active = conflict;
    setConflict(null);
    await workoutsRepo.finish(active.id);
    await begin();
  }

  /** Links out of a draft: today's changes live only on this screen — confirm before dropping them. */
  const guardLeave = (href: string) => (e: React.MouseEvent) => {
    if (!isDraft || !dirty) return;
    e.preventDefault();
    setLeaveTo(href);
  };

  // Leaving the app (lock screen, switching apps) — make sure pending writes finish.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") actions.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [actions]);

  if (full === "missing") {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-5">
        <p className="text-[15px]">{isDraft ? "План не найден." : "Тренировка не найдена."}</p>
        <ButtonLink href="/" variant="primary">
          К планам
        </ButtonLink>
      </div>
    );
  }
  if (!full) return null;

  const { workout, items } = full;
  if (workout.status !== "in_progress") {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 p-5">
        <p className="text-[15px]">Эта тренировка уже завершена.</p>
        <ButtonLink href="/" variant="primary">
          К планам
        </ButtonLink>
      </div>
    );
  }

  const { done, total } = progress(items);
  const title = full.plan?.name ?? "Тренировка без плана";
  const showBefore = !beforeHidden;
  const noteItem = noteFor !== null ? items[noteFor] : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-3.5 bg-surface-inverse px-4 pt-5 pb-4 text-on-inverse">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            onClick={guardLeave("/")}
            aria-label={isDraft ? "К планам" : "К планам (тренировка продолжится)"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-line-inverse"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="line-clamp-2 font-display text-[17px] leading-tight font-bold">{title}</h1>
            {isDraft ? (
              <>
                <div className="font-mono text-[13px] text-on-inverse-muted">
                  ещё не начата · {total} {plural(total, EXERCISE_FORMS)}
                </div>
                <div className="text-xs text-on-inverse-muted">правки — только на сегодня, план не меняется</div>
              </>
            ) : (
              <>
                <div className="font-mono text-[13px] text-on-inverse-muted">идёт {elapsed(workout.started_at)}</div>
                <div className="font-mono text-[13px] text-on-inverse-muted">начало {formatTime(workout.started_at)}</div>
              </>
            )}
            <div role="status" className={`flex items-center gap-1.5 text-xs ${saveFailed ? "text-accent" : "text-positive-on-inverse"}`}>
              {saveFailed ? (
                "не удалось сохранить — проверьте память телефона"
              ) : savedAt ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  сохранено в телефоне · {clock(savedAt)}
                </>
              ) : null}
            </div>
          </div>
          {isDraft ? (
            <Button variant="accent" size="md" onClick={begin} disabled={starting}>
              <PlayIcon />
              Начать
            </Button>
          ) : (
            <ButtonLink href={`/workout/finish/?id=${workout.id}`} variant="accent" size="md">
              Завершить
            </ButtonLink>
          )}
        </div>
        {!isDraft && (
        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-line-inverse"
            role="progressbar"
            aria-label="Выполнено упражнений"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="h-2 rounded-full bg-accent transition-[width] duration-300" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
          </div>
          <div className="font-mono text-[15px] font-bold">
            {done} / {total}
          </div>
        </div>
        )}
      </header>

      {showBefore && (
        <section className="mx-4 mt-3.5 flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">До тренировки</h2>
            <button type="button" onClick={() => setBeforeHidden(true)} className="min-h-11 px-1 text-[13px] text-ink-muted underline">
              {workout.wellbeing_before !== null || workout.mood_before !== null ? "Скрыть" : "Пропустить"}
            </button>
          </div>
          <Scale5 label="Самочувствие" value={workout.wellbeing_before} onChange={(v) => actions.setWorkout({ wellbeing_before: v })} />
          <Scale5 label="Настроение" value={workout.mood_before} onChange={(v) => actions.setWorkout({ mood_before: v })} />
        </section>
      )}

      <div className="flex flex-col gap-2 px-4 pt-3">
        {isDraft && items.length > 0 && (
          <p className="text-[13px] text-ink-muted">Нажмите на упражнение, чтобы поменять вес, повторы или подходы, заменить или пропустить его.</p>
        )}
        {items.length === 0 && (
          <p className="py-4 text-[15px] text-ink-muted">Добавьте первое упражнение — из каталога или новое.</p>
        )}
        {items.map((item, i) => (
          <ExerciseCard
            key={item.we.id}
            item={item}
            index={i}
            total={items.length}
            open={open === item.we.id}
            planning={isDraft}
            last={last.get(item.exercise.id)}
            onToggleOpen={() => setOpen(open === item.we.id ? null : item.we.id)}
            onToggleDone={() => actions.toggleExercise(i)}
            onToggleSet={(s) => actions.toggleSet(i, s)}
            onValue={(s, field, value) => actions.setValue(i, s, field, value)}
            onAddSet={() => actions.addSet(i)}
            onRemoveSet={() => actions.removeLastSet(i)}
            onReplace={() => setPicker({ kind: "replace", index: i })}
            onNote={() => setNoteFor(i)}
            onSkip={() => actions.setSkipped(i, !item.we.skipped)}
            onMove={(dir) => actions.move(i, dir)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-8">
        <Button variant="ghost" size="lg" onClick={() => setPicker({ kind: "add" })}>
          + Добавить упражнение
        </Button>
        {isDraft ? (
          <>
            <Button variant="accent" size="lg" className="min-h-14 font-display" onClick={begin} disabled={starting}>
              <PlayIcon />
              Начать тренировку
            </Button>
            {full.plan && (
              <Link
                href={`/plans/edit/?id=${full.plan.id}`}
                onClick={guardLeave(`/plans/edit/?id=${full.plan.id}`)}
                className="self-center py-2 text-[13px] text-ink-muted underline underline-offset-2"
              >
                Изменить сам план «{full.plan.name}»
              </Link>
            )}
          </>
        ) : (
          <Button variant="primary" size="lg" className="min-h-14 font-display" onClick={async () => {
            await actions.flush();
            router.push(`/workout/finish/?id=${workout.id}`);
          }}>
            Завершить тренировку
          </Button>
        )}
      </div>

      <ExercisePicker
        open={picker !== null}
        title={picker?.kind === "replace" ? "Заменить на сегодня" : "Добавить упражнение"}
        disabledIds={picker?.kind === "replace" ? [items[picker.index]?.exercise.id] : undefined}
        onClose={() => setPicker(null)}
        onPick={async (e) => {
          const p = picker;
          setPicker(null);
          if (p?.kind === "replace") await actions.replaceExercise(p.index, e);
          else await actions.addExercise(e);
        }}
      />

      <Sheet open={noteItem !== null} onClose={() => setNoteFor(null)} title={noteItem ? `Заметка: ${noteItem.exercise.name}` : ""}>
        {noteItem && noteFor !== null && (
          <NoteForm
            key={noteItem.we.id}
            initial={noteItem.we.note ?? ""}
            onSave={(note) => {
              actions.setNote(noteFor, note);
              setNoteFor(null);
            }}
          />
        )}
      </Sheet>

      <StartConflictSheet active={conflict} onClose={() => setConflict(null)} onFinishAndStart={finishActiveAndBegin} />
      <LeaveDraftSheet to={leaveTo} onClose={() => setLeaveTo(null)} />
    </div>
  );
}

function LeaveDraftSheet({ to, onClose }: { to: string | null; onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet
      open={to !== null}
      onClose={onClose}
      title="Выйти, не начав?"
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={onClose}>
            Остаться
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              if (to) router.push(to);
            }}
          >
            Выйти без правок
          </Button>
        </div>
      }
    >
      <p className="text-[15px]">Тренировка ещё не начата, поэтому правки на сегодня не сохранятся.</p>
    </Sheet>
  );
}

function NoteForm({ initial, onSave }: { initial: string; onSave: (note: string | null) => void }) {
  const [note, setNote] = useState(initial);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(note.trim() || null);
      }}
    >
      <Field label="Только для этой тренировки" value={note} onChange={(e) => setNote(e.target.value)} placeholder="сегодня резинкой" autoFocus enterKeyHint="done" />
      <Button type="submit" variant="primary">
        Сохранить заметку
      </Button>
    </form>
  );
}
