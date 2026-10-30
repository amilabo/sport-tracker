// The rest timer in the gym (stage 35): which set comes next, how long to rest, what to record.
import { setRestFor } from "./rest";
import type { Id, IsoDateTime, RestSnapshot, RestTimer, WorkoutExercise, WorkoutSet } from "./types";

type TimerItem = {
  we: Pick<WorkoutExercise, "id" | "skipped" | "rest_set_sec">;
  sets: Pick<WorkoutSet, "id" | "done_at">[];
};

export interface NextSet {
  index: number;
  setIndex: number;
  /** Same exercise — rest between sets; another one — rest between exercises. */
  kind: "set" | "exercise";
}

/**
 * The set to do after exercise `fromIndex`: an undone set of the same exercise first, then the next exercises
 * in order, then the ones left behind above. Skipped exercises are passed over. null — everything is done.
 */
export function nextSet(items: TimerItem[], fromIndex: number): NextSet | null {
  const firstUndone = (i: number) => items[i].sets.findIndex((s) => !s.done_at);
  const own = items[fromIndex] && !items[fromIndex].we.skipped ? firstUndone(fromIndex) : -1;
  if (own >= 0) return { index: fromIndex, setIndex: own, kind: "set" };
  for (let step = 1; step < items.length; step++) {
    const i = (fromIndex + step) % items.length;
    if (items[i].we.skipped) continue;
    const s = firstUndone(i);
    if (s >= 0) return { index: i, setIndex: s, kind: "exercise" };
  }
  return null;
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
  const next = nextSet(items, fromIndex);
  if (!next) return null;
  const item = items[next.index];
  const target = next.kind === "set" ? setRestFor(snapshot, item.we.rest_set_sec) : snapshot.rest_exercise_sec;
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

export function elapsedSec(timer: Pick<RestTimer, "since">, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(timer.since)) / 1000));
}

/** Seconds of rest left; below zero — rested longer than planned. */
export function remainingSec(timer: Pick<RestTimer, "since" | "target_sec">, now: number): number {
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

/** «Начать подход»: rest is over, the set is being done. */
export function startWork(timer: RestTimer, at: IsoDateTime): RestTimer {
  return { ...timer, phase: "work", since: at, target_sec: 0 };
}

/** «+0:24» over the plan, «1:12» left. */
export function formatCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const text = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
  return sec < 0 ? `+${text}` : text;
}
