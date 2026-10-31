// The rest timer in the gym (stage 35): which set comes next, how long to rest, what to record.
import { setRestFor } from "./rest";
import type { Id, IsoDateTime, RestSnapshot, RestTimer, WorkoutExercise, WorkoutSet } from "./types";

type TimerItem = {
  we: Pick<WorkoutExercise, "id" | "skipped" | "rest_set_sec" | "circuit_id">;
  sets: Pick<WorkoutSet, "id" | "done_at">[];
};

export interface NextSet {
  index: number;
  setIndex: number;
  /** Same exercise; another exercise; next exercise of the same circuit round; a new round. */
  kind: RestTimer["kind"];
}

/** Undone sets of a circuit, round by round: round 1 of every member, then round 2… Skipped members are passed over. */
function circuitOrder(items: TimerItem[], circuitId: Id): { index: number; setIndex: number }[] {
  const members = items.map((it, index) => ({ it, index })).filter(({ it }) => it.we.circuit_id === circuitId && !it.we.skipped);
  const rounds = Math.max(0, ...members.map(({ it }) => it.sets.length));
  const out: { index: number; setIndex: number }[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const { it, index } of members) if (it.sets[r] && !it.sets[r].done_at) out.push({ index, setIndex: r });
  }
  return out;
}

/**
 * The set to do after set `fromSetIndex` of exercise `fromIndex` (-1 — the exercise as a whole).
 * In a circuit — the next member of the round, then the next round. Otherwise an undone set of the same exercise,
 * then the next exercises in order, then the ones left behind above. Skipped exercises are passed over.
 * null — everything is done.
 */
export function nextSet(items: TimerItem[], fromIndex: number, fromSetIndex = -1): NextSet | null {
  const from = items[fromIndex];
  if (!from) return null;
  let after = fromIndex;
  const cid = from.we.circuit_id;
  if (cid) {
    const next = circuitOrder(items, cid)[0];
    if (next) return { ...next, kind: fromSetIndex >= 0 && next.setIndex === fromSetIndex ? "inside" : "round" };
    after = items.reduce((last, it, i) => (it.we.circuit_id === cid ? i : last), fromIndex);
  } else if (!from.we.skipped) {
    const own = from.sets.findIndex((s) => !s.done_at);
    if (own >= 0) return { index: fromIndex, setIndex: own, kind: "set" };
  }
  for (let step = 1; step < items.length; step++) {
    const i = (after + step) % items.length;
    const it = items[i];
    if (it.we.skipped || (cid && it.we.circuit_id === cid)) continue;
    if (it.we.circuit_id) {
      const first = circuitOrder(items, it.we.circuit_id)[0];
      if (first) return { ...first, kind: "exercise" };
      continue;
    }
    const s = it.sets.findIndex((x) => !x.done_at);
    if (s >= 0) return { index: i, setIndex: s, kind: "exercise" };
  }
  return null;
}

function targetFor(snapshot: RestSnapshot, item: TimerItem, kind: RestTimer["kind"]): number {
  if (kind === "set") return setRestFor(snapshot, item.we.rest_set_sec);
  if (kind === "exercise") return snapshot.rest_exercise_sec;
  const circuit = snapshot.circuits?.find((c) => c.id === item.we.circuit_id);
  if (!circuit) return snapshot.rest_exercise_sec;
  return kind === "inside" ? circuit.rest_inside_sec : circuit.rest_round_sec;
}

/**
 * Rest after a set (or a whole exercise) is done at `at`. null — nothing is left, or the rest is 0:00.
 * `fromSetId` null — the exercise was ticked as a whole (big ✓).
 */
export function restAfter(
  snapshot: RestSnapshot,
  items: TimerItem[],
  fromIndex: number,
  at: IsoDateTime,
  fromSetId: Id | null,
): RestTimer | null {
  const fromSetIndex = fromSetId ? (items[fromIndex]?.sets.findIndex((s) => s.id === fromSetId) ?? -1) : -1;
  const next = nextSet(items, fromIndex, fromSetIndex);
  if (!next) return null;
  const item = items[next.index];
  const target = targetFor(snapshot, item, next.kind);
  if (target <= 0) return null;
  return {
    phase: "rest",
    since: at,
    target_sec: target,
    kind: next.kind,
    we_id: item.we.id,
    set_id: item.sets[next.setIndex].id,
    from_we_id: items[fromIndex]?.we.id ?? null,
    from_set_id: fromSetId,
  };
}

/** Seconds since the phase began; on «Пауза» (stage 39) the clock stands at the pause. */
export function elapsedSec(timer: Pick<RestTimer, "since" | "paused_at">, now: number): number {
  const at = timer.paused_at ? Math.min(now, Date.parse(timer.paused_at)) : now;
  return Math.max(0, Math.floor((at - Date.parse(timer.since)) / 1000));
}

/** Seconds of rest left; below zero — rested longer than planned. */
export function remainingSec(timer: Pick<RestTimer, "since" | "target_sec" | "paused_at">, now: number): number {
  return timer.target_sec - elapsedSec(timer, now);
}

/** −/+ 15 s for today only; the plan does not change. */
export function adjustRest(timer: RestTimer, dir: 1 | -1): RestTimer {
  return { ...timer, target_sec: Math.max(0, timer.target_sec + dir * 15) };
}

/** What the set keeps about the rest before it. `approx` — ticked without «Начать подход». */
export function restRecord(timer: Pick<RestTimer, "since" | "target_sec">, at: IsoDateTime, approx: boolean) {
  return {
    rest_sec: elapsedSec(timer, Date.parse(at)),
    rest_target_sec: timer.target_sec,
    ...(approx ? { rest_approx: true } : {}),
  };
}

/** «Начать подход»: rest is over, the set is being done; in a timed circuit — for its work time (stage 39). */
export function startWork(timer: RestTimer, at: IsoDateTime, workSec = 0): RestTimer {
  const { paused_at: _paused, ...rest } = timer;
  void _paused;
  return { ...rest, phase: "work", since: at, target_sec: workSec };
}

/** «+0:24» over the plan, «1:12» left. */
export function formatCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const text = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  return sec < 0 ? `+${text}` : text;
}
