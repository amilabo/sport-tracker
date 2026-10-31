// A circuit by time (stage 39, mockups Т1–Т3): work and rest run by the clock, no taps between them.
// The timer is stored with the workout as before (RestTimer); what passed while the screen was off or the app closed
// is counted from the timestamps — `catchUp` replays it, so the sets and the clock always agree.
import { circuitCurrent } from "./circuit";
import { formatRest } from "./rest";
import { nextSet, restAfter } from "./rest-timer";
import { weightText } from "./sets";
import type { Exercise, IsoDateTime, PlanCircuit, RestSnapshot, RestTimer, WorkoutExercise, WorkoutSet } from "./types";

export type TimedItem = {
  we: Pick<WorkoutExercise, "id" | "skipped" | "rest_set_sec" | "circuit_id">;
  exercise: Pick<Exercise, "log_type">;
  sets: WorkoutSet[];
};

/** The circuit if it is «По времени». */
export function timedCircuit(snapshot: RestSnapshot | undefined, circuitId: string | null | undefined): PlanCircuit | null {
  if (!snapshot || !circuitId) return null;
  const c = snapshot.circuits?.find((x) => x.id === circuitId);
  return c?.mode === "timed" && c.work_sec ? c : null;
}

/** Work time of an exercise in a timed circuit; null — not in one. */
export function workSecFor(snapshot: RestSnapshot | undefined, item: Pick<TimedItem, "we"> | undefined): number | null {
  return item ? (timedCircuit(snapshot, item.we.circuit_id)?.work_sec ?? null) : null;
}

/** «Круг ≈ 2:40, тренировка ≈ 11 мин» (Т1): rest inside only between exercises, the last one is followed by the round rest. */
export function timedEstimate(circuit: Pick<PlanCircuit, "rounds" | "rest_inside_sec" | "rest_round_sec" | "work_sec">, exercises: number): { roundSec: number; totalSec: number } {
  const n = Math.max(0, exercises);
  const work = circuit.work_sec ?? 0;
  const roundSec = n * work + Math.max(0, n - 1) * circuit.rest_inside_sec;
  return { roundSec, totalSec: circuit.rounds * roundSec + Math.max(0, circuit.rounds - 1) * circuit.rest_round_sec };
}

const HAS_REPS = new Set<Exercise["log_type"]>(["weight_reps", "reps", "bodyweight_plus"]);
const HAS_WEIGHT = new Set<Exercise["log_type"]>(["weight_reps", "bodyweight_plus"]);

/**
 * The card line in a circuit by time (Т2, Т3): the round now, or the last one when all are done —
 * «16 кг · 0:40» before it, «16 кг · 18 раз» once the reps are written; own weight — «0:40» / «18 раз».
 */
export function timedSetSummary(logType: Exercise["log_type"], sets: Pick<WorkoutSet, "weight" | "reps" | "done_at">[], workSec: number): string {
  const s = sets.find((x) => !x.done_at) ?? sets.at(-1);
  if (!s) return formatRest(workSec);
  const parts: string[] = [];
  if (HAS_WEIGHT.has(logType) && s.weight !== null) parts.push(`${weightText(logType, s.weight)} кг`);
  parts.push(s.done_at && s.reps !== null && HAS_REPS.has(logType) ? `${s.reps} раз` : formatRest(workSec));
  return parts.join(" · ");
}
const sec = (fromIso: IsoDateTime, toMs: number) => Math.max(0, Math.round((toMs - Date.parse(fromIso)) / 1000));

interface State {
  items: TimedItem[];
  changed: Map<string, WorkoutSet>;
}

function locate(state: State, timer: Pick<RestTimer, "we_id" | "set_id">) {
  const index = state.items.findIndex((it) => it.we.id === timer.we_id);
  const setIndex = index >= 0 ? state.items[index].sets.findIndex((s) => s.id === timer.set_id) : -1;
  return { index, setIndex };
}

function put(state: State, index: number, setIndex: number, set: WorkoutSet) {
  state.items = state.items.map((it, i) => (i === index ? { ...it, sets: it.sets.map((s, k) => (k === setIndex ? set : s)) } : it));
  state.changed.set(set.id, set);
}

/** The set's work begins at `atMs`: the rest before it is recorded exactly, the clock counts the work. */
function beginWork(snapshot: RestSnapshot, state: State, timer: RestTimer, atMs: number): RestTimer | null {
  const { index, setIndex } = locate(state, timer);
  const work = workSecFor(snapshot, state.items[index]);
  if (setIndex < 0 || !work) return null;
  const at = new Date(atMs).toISOString();
  const s = state.items[index].sets[setIndex];
  const rest = timer.phase === "rest" ? { rest_sec: sec(timer.since, atMs), rest_target_sec: timer.target_sec } : {};
  put(state, index, setIndex, { ...s, ...rest, started_at: at, updated_at: at });
  return { ...timer, phase: "work", since: at, target_sec: work, paused_at: undefined };
}

/**
 * The work ends at `atMs`: the set is done with its actual time; reps are prefilled from the last round (written during
 * the rest or later). Then the rest inside the circuit or between rounds, or — at 0:00 — straight to the next work.
 */
function finishWork(snapshot: RestSnapshot, state: State, timer: RestTimer, atMs: number): RestTimer | null {
  const { index, setIndex } = locate(state, timer);
  if (setIndex < 0) return null;
  const item = state.items[index];
  const s = item.sets[setIndex];
  const at = new Date(atMs).toISOString();
  const prevReps = setIndex > 0 ? item.sets[setIndex - 1].reps : null;
  const reps = s.reps === null && HAS_REPS.has(item.exercise.log_type) && prevReps !== null ? prevReps : s.reps;
  put(state, index, setIndex, { ...s, done_at: at, started_at: s.started_at ?? timer.since, duration_sec: sec(timer.since, atMs), reps, updated_at: at });
  const rest = restAfter(snapshot, state.items, index, at, s.id);
  if (rest) return rest;
  // Rest 0:00 inside the circuit: the next exercise starts at once.
  const next = nextSet(state.items, index, setIndex);
  if (!next || (next.kind !== "inside" && next.kind !== "round") || !workSecFor(snapshot, state.items[next.index])) return null;
  const target = state.items[next.index];
  return beginWork(snapshot, state, { ...timer, phase: "rest", since: at, target_sec: 0, kind: next.kind, we_id: target.we.id, set_id: target.sets[next.setIndex].id, from_we_id: item.we.id, from_set_id: s.id }, atMs);
}

/** When the running phase ends, ms; null — it does not end by itself (paused, not timed, a rest from outside the circuit). */
function autoEnd(snapshot: RestSnapshot, state: State, timer: RestTimer): number | null {
  if (timer.paused_at) return null;
  const { index } = locate(state, timer);
  if (!workSecFor(snapshot, state.items[index])) return null;
  if (timer.phase === "work") return timer.target_sec > 0 ? Date.parse(timer.since) + timer.target_sec * 1000 : null;
  if (timer.kind !== "inside" && timer.kind !== "round") return null;
  return Date.parse(timer.since) + timer.target_sec * 1000;
}

export interface TimedChange {
  timer: RestTimer | null;
  /** Sets to write: done ones, the rest and start of the next. */
  sets: WorkoutSet[];
}

/**
 * Replays every phase that ended by `now` (the screen was off, the app closed): marks the sets done at their exact end,
 * records the rests, and returns the timer as it should be now. Nothing ended — the same timer, no sets.
 */
export function catchUp(snapshot: RestSnapshot, items: TimedItem[], timer: RestTimer | null, now: number): TimedChange {
  const state: State = { items, changed: new Map() };
  let t = timer;
  for (let guard = 0; t && guard < 1000; guard++) {
    const end = autoEnd(snapshot, state, t);
    if (end === null || end > now) break;
    t = t.phase === "work" ? finishWork(snapshot, state, t, end) : beginWork(snapshot, state, t, end);
  }
  return { timer: t, sets: [...state.changed.values()] };
}

/** «Закончить раньше»: the work ends now, the rest starts. */
export function finishEarly(snapshot: RestSnapshot, items: TimedItem[], timer: RestTimer, now: number): TimedChange {
  if (timer.phase !== "work") return { timer, sets: [] };
  const state: State = { items, changed: new Map() };
  const t = finishWork(snapshot, state, { ...timer, paused_at: undefined }, now);
  return { timer: t, sets: [...state.changed.values()] };
}

/** «Начать сейчас»: the rest ends now, the next exercise starts. */
export function startNow(snapshot: RestSnapshot, items: TimedItem[], timer: RestTimer, now: number): TimedChange {
  if (timer.phase !== "rest") return { timer, sets: [] };
  const state: State = { items, changed: new Map() };
  const t = beginWork(snapshot, state, { ...timer, paused_at: undefined }, now);
  return { timer: t, sets: [...state.changed.values()] };
}

/** «Начать круг»: the first undone set of the first timed circuit not finished yet. null — nothing to start. */
export function startTimed(snapshot: RestSnapshot, items: TimedItem[], now: number): TimedChange | null {
  for (const c of snapshot.circuits ?? []) {
    if (c.mode !== "timed") continue;
    const index = circuitCurrent(items, c.id);
    if (index < 0) continue;
    const item = items[index];
    const set = item.sets.find((s) => !s.done_at)!;
    const state: State = { items, changed: new Map() };
    const seed: RestTimer = { phase: "work", since: new Date(now).toISOString(), target_sec: 0, kind: "inside", we_id: item.we.id, set_id: set.id, from_we_id: null, from_set_id: null };
    const t = beginWork(snapshot, state, seed, now);
    return { timer: t, sets: [...state.changed.values()] };
  }
  return null;
}

/** «Пауза»: the clock stops. */
export function pause(timer: RestTimer, now: number): RestTimer {
  return timer.paused_at ? timer : { ...timer, paused_at: new Date(now).toISOString() };
}

/** Resume: the start moves forward by the pause, so the time left is what it was. */
export function resume(timer: RestTimer, now: number): RestTimer {
  if (!timer.paused_at) return timer;
  const { paused_at, ...rest } = timer;
  return { ...rest, since: new Date(Date.parse(timer.since) + (now - Date.parse(paused_at))).toISOString() };
}

/** The first timed circuit that still has something to do — for «Начать круг» when there is no timer. */
export function pendingTimedCircuit(snapshot: RestSnapshot | undefined, items: TimedItem[]): PlanCircuit | null {
  for (const c of snapshot?.circuits ?? []) if (c.mode === "timed" && circuitCurrent(items, c.id) >= 0) return c;
  return null;
}
