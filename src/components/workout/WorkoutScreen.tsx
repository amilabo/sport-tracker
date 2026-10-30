"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { TechniqueSheet } from "@/components/exercises/Technique";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Scale5 } from "@/components/ui/Scale5";
import { Sheet } from "@/components/ui/Sheet";
import { Snackbar } from "@/components/ui/Snackbar";
import { techniqueOf } from "@/content/technique";
import { daysSinceLast, isComeback, planWeightNote } from "@/domain/analytics/comeback";
import { COMEBACK_DEFAULT, COMEBACK_OPTIONS } from "@/domain/analytics/thresholds";
import { exercisesRepo } from "@/db/repos/exercises";
import { workoutsRepo, type WorkoutItem } from "@/db/repos/workouts";
import { EXERCISE_FORMS, formatNumber, formatTime, plural } from "@/domain/format";
import type { Exercise, Id, Workout } from "@/domain/types";
import { progress } from "@/domain/workout";
import { primeSignal } from "@/lib/signal";
import { useWakeLock } from "@/lib/wake-lock";
import { circuitCurrent, circuitProgress } from "@/domain/circuit";
import { CircuitHeader } from "./CircuitHeader";
import { ExerciseCard } from "./ExerciseCard";
import { RestPanel } from "./RestPanel";
import { StartConflictSheet } from "./StartConflictSheet";
import { FREE_DRAFT, useWorkoutSession } from "./useWorkoutSession";

/**
 * /workout/?id=… — a workout; /workout/?plan=… — the plan's workout before "Начать";
 * without either — the workout in progress, if any.
 */
export function WorkoutRoute() {
  const params = useSearchParams();
  const id = params.get("id");
  const planId = params.get("plan");
  const free = params.get("free") !== null;
  const router = useRouter();
  const [activeId, setActiveId] = useState<Id | null | "none">(null);

  useEffect(() => {
    if (id || planId || free) return;
    workoutsRepo.getActive().then((w) => {
      if (w) router.replace(`/workout/?id=${w.id}`);
      else setActiveId("none");
    });
  }, [id, planId, free, router]);

  if (id) return <WorkoutScreen key={id} kind="workout" targetId={id} />;
  if (planId) return <WorkoutScreen key={`plan-${planId}`} kind="draft" targetId={planId} />;
  if (free) return <WorkoutScreen key="free" kind="draft" targetId={FREE_DRAFT} />;
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

/** The current exercise of the first circuit not finished yet; undefined — no circuit or all done. */
function circuitFocus(items: WorkoutItem[]): Id | undefined {
  const ids = [...new Set(items.map((it) => it.we.circuit_id).filter((c): c is string => !!c))];
  for (const cid of ids) {
    const i = circuitCurrent(items, cid);
    if (i >= 0) return items[i].we.id;
  }
  return undefined;
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

/** The last replacement while its message is on screen: «Отменить», «Запомнить замену». */
interface Replaced {
  before: WorkoutItem;
  /** The plan's exercise of the slot. */
  original: Exercise;
  picked: Exercise;
  /** The plan's exercise picked back. */
  back: boolean;
  /** Picked back, or picked «Ваша замена»: there is nothing to remember. */
  nothingToRemember: boolean;
  remembered: boolean;
}

function replacedMessage(r: Replaced): string {
  if (r.remembered) return "Запомнили — в следующий раз она будет первой.";
  if (r.back) return "Вернули упражнение из плана.";
  return "Заменено на сегодня. План не меняется.";
}

// «До тренировки» folded: remembered for this workout (the id survives "Начать") while the app is open.
const BEFORE_KEY = "st-before-collapsed";

function readBeforeCollapsed(): Id | null {
  try {
    return sessionStorage.getItem(BEFORE_KEY);
  } catch {
    return null;
  }
}

function writeBeforeCollapsed(id: Id | null) {
  try {
    if (id) sessionStorage.setItem(BEFORE_KEY, id);
    else sessionStorage.removeItem(BEFORE_KEY);
  } catch {
    // Storage unavailable (private mode): folding still works until the screen is closed.
  }
}

function beforeSummary(workout: Workout): string {
  if (workout.wellbeing_before === null && workout.mood_before === null) return "не отмечено";
  return `самочувствие ${workout.wellbeing_before ?? "—"} · настроение ${workout.mood_before ?? "—"}`;
}

function WorkoutScreen({ kind, targetId }: { kind: "workout" | "draft"; targetId: Id }) {
  const router = useRouter();
  const { full, last, savedAt, saveFailed, dirty, isDraft, actions } = useWorkoutSession(kind, targetId);
  const [open, setOpen] = useState<Id | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [techFor, setTechFor] = useState<number | null>(null);
  const [collapsedId, setCollapsedId] = useState<Id | null>(readBeforeCollapsed);
  const [starting, setStarting] = useState(false);
  const [conflict, setConflict] = useState<Workout | null>(null);
  /** Leaving a draft with changes: where to, once confirmed. */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<Replaced | null>(null);
  const hideReplaced = useCallback(() => setReplaced(null), []);
  /** Back after a break (stage 44): days without workouts and the lowering picked; null — no card. */
  const [comeback, setComeback] = useState<{ days: number; pct: number } | null>(null);
  const comebackChecked = useRef(false);
  useMinuteClock();

  // A plan's draft after 14+ days without workouts opens with weights lowered by 15 % — for this workout only.
  const draftLoaded = isDraft && !!full && full !== "missing" && !!full.plan;
  const { lowerWeights } = actions;
  useEffect(() => {
    if (!draftLoaded || comebackChecked.current) return;
    comebackChecked.current = true;
    workoutsRepo.listCompleted().then((completed) => {
      const days = daysSinceLast(completed, new Date());
      if (!isComeback(days)) return;
      setComeback({ days, pct: COMEBACK_DEFAULT });
      lowerWeights(COMEBACK_DEFAULT, true);
    });
  }, [draftLoaded, lowerWeights]);

  // A workout with rest (stage 35): the screen stays on, the card of the next set opens by itself.
  const running = full && full !== "missing" && full.workout.status === "in_progress" && !isDraft ? full.workout : null;
  const screenOn = useWakeLock(!!running?.rest);
  // The exercise to do now: the one the timer counts down to, or — with no timer (0:00 in a circuit) —
  // the circuit's current one. When it changes, its card opens and scrolls to the top (stage 38).
  const focusWe = running?.rest && full && full !== "missing" ? (running.timer?.we_id ?? circuitFocus(full.items)) : undefined;
  const [lastFocus, setLastFocus] = useState<Id | undefined>(undefined);
  if (focusWe && focusWe !== lastFocus) {
    setLastFocus(focusWe);
    setOpen(focusWe);
  }
  useEffect(() => {
    if (!lastFocus) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After the card has opened (its height is laid out): the exercise just done stays on top, collapsed,
    // so it is clear what was finished; the new one is right under it. In a circuit — its «Круг 2 из 3» header.
    const t = setTimeout(() => {
      const card = document.getElementById(`we-${lastFocus}`);
      if (!card) return;
      const prev = card.previousElementSibling;
      const target = prev && (prev.tagName === "ARTICLE" || prev.hasAttribute("data-circuit-header")) ? prev : card;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 12, behavior: reduce ? "auto" : "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [lastFocus]);

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
        <p className="text-[15px]">{isDraft && targetId !== FREE_DRAFT ? "План не найден." : "Тренировка не найдена."}</p>
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
  const beforeCollapsed = collapsedId === workout.id;
  const toggleBefore = () => {
    const next = beforeCollapsed ? null : workout.id;
    setCollapsedId(next);
    writeBeforeCollapsed(next);
  };
  const noteItem = noteFor !== null ? items[noteFor] : null;
  const techExercise = techFor !== null ? (items[techFor]?.exercise ?? null) : null;
  const replacing = picker?.kind === "replace" ? items[picker.index] : undefined;

  // Exercises of one circuit (stage 36) are drawn together under «Круг 2 из 3»; the one to do now is outlined.
  const blocks: { cid: string | null; indices: number[] }[] = [];
  items.forEach((item, i) => {
    const cid = item.we.circuit_id ?? null;
    const last = blocks.at(-1);
    if (cid && last?.cid === cid) last.indices.push(i);
    else blocks.push({ cid, indices: [i] });
  });
  const current = new Set(isDraft ? [] : blocks.filter((b) => b.cid).map((b) => circuitCurrent(items, b.cid!)).filter((i) => i >= 0));

  const roundDone = (i: number) => {
    const cid = items[i].we.circuit_id;
    if (!cid || isDraft) return undefined;
    return !!items[i].sets[circuitProgress(items, cid).round - 1]?.done_at;
  };

  const renderCard = (i: number) => {
    const item = items[i];
    return (
      <ExerciseCard
        key={item.we.id}
        item={item}
        index={i}
        total={items.length}
        open={open === item.we.id}
        current={current.has(i)}
        roundDone={roundDone(i)}
        planning={isDraft}
        planWeight={comeback?.pct ? planWeightNote(item.sets, (kg) => formatNumber(kg, 2)) : null}
        last={last.get(item.exercise.id)}
        onToggleOpen={() => setOpen(open === item.we.id ? null : item.we.id)}
        onToggleDone={() => {
          primeSignal();
          actions.toggleExercise(i);
        }}
        onToggleSet={(s) => {
          primeSignal();
          actions.toggleSet(i, s);
        }}
        onValue={(s, field, value) => actions.setValue(i, s, field, value)}
        onAddSet={() => actions.addSet(i)}
        onRemoveSet={() => actions.removeLastSet(i)}
        onReplace={() => {
          setReplaced(null);
          setPicker({ kind: "replace", index: i });
        }}
        onNote={() => setNoteFor(i)}
        onSkip={() => actions.setSkipped(i, !item.we.skipped)}
        onMove={(dir) => actions.move(i, dir)}
        onTechnique={() => setTechFor(i)}
      />
    );
  };

  async function replace(index: number, exercise: Exercise) {
    const item = items[index];
    const planned = item.replaced ?? item.exercise;
    // Fresh from the store: «Ваша замена» may have been set after the workout was opened.
    const original = (await exercisesRepo.get(planned.id)) ?? planned;
    const before = await actions.replaceExercise(index, exercise);
    if (!before) return;
    const back = exercise.id === original.id;
    setReplaced({ before, original, picked: exercise, back, nothingToRemember: back || original.substitute_id === exercise.id, remembered: false });
  }

  async function remember(r: Replaced) {
    await exercisesRepo.setSubstitute(r.original.id, r.picked.id);
    setReplaced({ ...r, remembered: true });
  }

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
                <div className="text-xs text-on-inverse-muted">
                  {full.plan ? "правки — только на сегодня, план не меняется" : "добавьте упражнения сейчас или после «Начать»"}
                </div>
              </>
            ) : (
              <>
                <div className="font-mono text-[13px] text-on-inverse-muted">идёт {elapsed(workout.started_at)}</div>
                <div className="font-mono text-[13px] text-on-inverse-muted">начало {formatTime(workout.started_at)}</div>
              </>
            )}
            <div role="status" className={`flex items-center gap-1.5 text-xs ${saveFailed ? "text-danger-on-inverse" : "text-positive-on-inverse"}`}>
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

      {isDraft && comeback && (
        <ComebackCard
          days={comeback.days}
          pct={comeback.pct}
          onPick={(pct) => {
            setComeback({ ...comeback, pct });
            actions.lowerWeights(pct);
          }}
        />
      )}

      <section className="mx-4 mt-3.5 flex flex-col rounded-2xl border-[1.5px] border-line bg-surface">
        <h2>
          <button
            type="button"
            aria-expanded={!beforeCollapsed}
            aria-controls="before-ratings"
            onClick={toggleBefore}
            className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-xs font-bold tracking-[0.04em] uppercase">До тренировки</span>
              {beforeCollapsed && <span className="font-mono text-[13px] text-ink-muted">{beforeSummary(workout)}</span>}
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`ml-auto shrink-0 text-ink-muted transition-transform ${beforeCollapsed ? "" : "rotate-180"}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span className="sr-only">{beforeCollapsed ? "Развернуть" : "Свернуть"}</span>
          </button>
        </h2>
        {!beforeCollapsed && (
          <div id="before-ratings" className="flex flex-col gap-2.5 px-3.5 pb-3">
            <Scale5 label="Самочувствие" value={workout.wellbeing_before} onChange={(v) => actions.setWorkout({ wellbeing_before: v })} />
            <Scale5 label="Настроение" value={workout.mood_before} onChange={(v) => actions.setWorkout({ mood_before: v })} />
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2 px-4 pt-3">
        {isDraft && items.length > 0 && (
          <p className="text-[13px] text-ink-muted">Нажмите на упражнение, чтобы поменять вес, повторы или подходы, заменить или пропустить его.</p>
        )}
        {items.length === 0 && (
          <p className="py-4 text-[15px] text-ink-muted">Добавьте первое упражнение — из каталога или новое.</p>
        )}
        {blocks.map((b) =>
          b.cid ? (
            <section key={`circuit-${b.cid}`} aria-label="Круг" className="flex flex-col gap-2 rounded-[22px] border-[1.5px] border-ink p-2">
              <CircuitHeader circuitId={b.cid} circuit={workout.rest?.circuits?.find((c) => c.id === b.cid)} items={items} />
              {b.indices.map((i) => renderCard(i))}
            </section>
          ) : (
            renderCard(b.indices[0])
          ),
        )}
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
        pickLabel={picker?.kind === "replace" ? "Заменить на это" : "Добавить"}
        disabledIds={replacing ? [replacing.exercise.id] : undefined}
        suggest={
          replacing
            ? { exerciseId: (replacing.replaced ?? replacing.exercise).id, excludeIds: items.map((it) => it.exercise.id), planned: !!replacing.replaced }
            : null
        }
        onClose={() => setPicker(null)}
        onPick={async (e) => {
          const p = picker;
          setPicker(null);
          if (p?.kind === "replace") await replace(p.index, e);
          else await actions.addExercise(e);
        }}
      />

      <TechniqueSheet
        exercise={techExercise}
        technique={techExercise && techniqueOf(techExercise)}
        onClose={() => setTechFor(null)}
        onLeave={(e) => {
          guardLeave(`/exercises/view/?id=${techExercise!.id}`)(e);
          if (e.defaultPrevented) setTechFor(null);
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

      <Snackbar
        message={replaced && replacedMessage(replaced)}
        token={replaced?.remembered}
        ms={replaced?.remembered ? 4000 : 8000}
        onClose={hideReplaced}
        actions={
          replaced &&
          !replaced.remembered && (
            <>
              <button
                type="button"
                className="min-h-11 rounded-xl border-[1.5px] border-line-inverse px-4 text-sm font-semibold transition-transform active:scale-[0.98]"
                onClick={() => {
                  actions.undoReplace(replaced.before);
                  setReplaced(null);
                }}
              >
                Отменить
              </button>
              {!replaced.nothingToRemember && (
                <Button variant="accent" size="md" onClick={() => remember(replaced)}>
                  Запомнить замену
                </Button>
              )}
            </>
          )
        }
      />

      {!isDraft && workout.rest && workout.timer && (
        <RestPanel
          timer={workout.timer}
          items={items}
          screenOn={screenOn}
          onAdjust={actions.adjustRest}
          onStartSet={actions.startSet}
          onFinishSet={actions.finishSet}
          onStop={actions.stopTimer}
        />
      )}

      <StartConflictSheet active={conflict} onClose={() => setConflict(null)} onFinishAndStart={finishActiveAndBegin} />
      <LeaveDraftSheet to={leaveTo} onClose={() => setLeaveTo(null)} />
    </div>
  );
}

const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];

/** А5: «18 дней без тренировок» and «−15 % / −10 % / Как в плане». */
function ComebackCard({ days, pct, onPick }: { days: number; pct: number; onPick: (pct: number) => void }) {
  return (
    <section aria-labelledby="comeback-h" className="mx-4 mt-3.5 flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3.5">
      <h2 id="comeback-h" className="text-[17px] font-bold">
        {days} {plural(days, DAY_FORMS)} без тренировок
      </h2>
      <p className="text-sm leading-[1.45] text-ink-muted">После перерыва обычно начинают полегче. Снизить веса на эту тренировку?</p>
      <div role="radiogroup" aria-label="Насколько снизить" className="grid grid-cols-3 gap-1.5">
        {COMEBACK_OPTIONS.map((o) => {
          const on = o === pct;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o)}
              className={`h-12 rounded-xl border-[1.5px] border-ink text-[15px] font-bold transition-colors ${on ? "bg-ink text-surface" : "text-ink"}`}
            >
              {o ? `−${o} %` : "Как в плане"}
            </button>
          );
        })}
      </div>
      <span className="text-[13px] text-ink-muted">План не меняется — только эта тренировка.</span>
    </section>
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
