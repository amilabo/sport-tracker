import { describe, expect, it } from "vitest";
import { cleanCircuits } from "./circuit";
import { catchUp, finishEarly, pause, resume, startNow, startTimed, timedEstimate, type TimedItem } from "./timed-circuit";
import type { LogType, RestSnapshot, WorkoutSet } from "./types";
import { newWorkoutExercise, newWorkoutSet } from "./workout";

const CID = "all";
const snap: RestSnapshot = {
  format: "circuit",
  rest_set_sec: 60,
  rest_exercise_sec: 120,
  circuits: [{ id: CID, rounds: 3, rest_inside_sec: 20, rest_round_sec: 90, mode: "timed", work_sec: 40 }],
};
const T0 = Date.parse("2026-10-31T10:00:00.000Z");
const at = (sec: number) => T0 + sec * 1000;

function item(name: string, logType: LogType, rounds = 3, skipped = false): TimedItem {
  const we = { ...newWorkoutExercise("w", name, 0, undefined, CID), id: name, skipped };
  const sets: WorkoutSet[] = Array.from({ length: rounds }, (_, i) => ({ ...newWorkoutSet(we.id, i, { weight: logType === "weight_reps" ? 16 : null, reps: null, duration_sec: null, speed_kmh: null }), id: `${name}-${i}` }));
  return { we, exercise: { log_type: logType }, sets };
}

/** Applies a change to the items, as the session does. */
function applied(items: TimedItem[], sets: WorkoutSet[]): TimedItem[] {
  const byId = new Map(sets.map((s) => [s.id, s]));
  return items.map((it) => ({ ...it, sets: it.sets.map((s) => byId.get(s.id) ?? s) }));
}

describe("timed circuit", () => {
  const items = [item("swing", "weight_reps"), item("goblet", "weight_reps"), item("push", "reps")];

  it("estimates like Т1: round 2:40, workout 11:00", () => {
    expect(timedEstimate(snap.circuits![0], 3)).toEqual({ roundSec: 160, totalSec: 660 });
  });

  it("keeps «По времени» through cleaning, a circuit by reps stays as it was", () => {
    expect(cleanCircuits([{ id: "a", rounds: 3, rest_inside_sec: 20, rest_round_sec: 90, mode: "timed", work_sec: 45 }])[0]).toMatchObject({ mode: "timed", work_sec: 45 });
    expect(cleanCircuits([{ id: "a", rounds: 3, rest_inside_sec: 20, rest_round_sec: 90 }])[0]).not.toHaveProperty("mode");
  });

  it("replays work → rest → work by the clock, with exact times", () => {
    const start = startTimed(snap, items, at(0))!;
    expect(start.timer).toMatchObject({ phase: "work", target_sec: 40, we_id: "swing", set_id: "swing-0" });
    let its = applied(items, start.sets);
    // The screen was off for 70 s: swing done at 0:40, rest 0:20, goblet started at 1:00, still working at 1:10.
    const c = catchUp(snap, its, start.timer, at(70));
    its = applied(its, c.sets);
    expect(its[0].sets[0]).toMatchObject({ done_at: new Date(at(40)).toISOString(), duration_sec: 40 });
    expect(its[1].sets[0]).toMatchObject({ started_at: new Date(at(60)).toISOString(), rest_sec: 20, rest_target_sec: 20 });
    expect(its[1].sets[0].rest_approx).toBeUndefined();
    expect(c.timer).toMatchObject({ phase: "work", we_id: "goblet", since: new Date(at(60)).toISOString() });
    // Nothing ended yet — nothing changes.
    expect(catchUp(snap, its, c.timer, at(71))).toEqual({ timer: c.timer, sets: [] });
  });

  it("the last exercise of a round rests between rounds; the last round ends the timer", () => {
    const start = startTimed(snap, items, at(0))!;
    let its = applied(items, start.sets);
    // Round 1: 3 × 40 + 2 × 20 = 160 s, then 90 s between rounds.
    let c = catchUp(snap, its, start.timer, at(161));
    its = applied(its, c.sets);
    expect(c.timer).toMatchObject({ phase: "rest", kind: "round", we_id: "swing", set_id: "swing-1", target_sec: 90 });
    // Everything: 3 × 160 + 2 × 90 = 660 s.
    c = catchUp(snap, its, c.timer, at(700));
    its = applied(its, c.sets);
    expect(c.timer).toBeNull();
    expect(its.every((it) => it.sets.every((s) => s.done_at))).toBe(true);
  });

  it("prefills reps from the last round", () => {
    const start = startTimed(snap, items, at(0))!;
    let its = applied(items, start.sets);
    let c = catchUp(snap, its, start.timer, at(41));
    its = applied(its, c.sets);
    its = its.map((it) => (it.we.id === "swing" ? { ...it, sets: it.sets.map((s, i) => (i === 0 ? { ...s, reps: 18 } : s)) } : it));
    c = catchUp(snap, its, c.timer, at(161 + 90 + 41));
    its = applied(its, c.sets);
    expect(its[0].sets[1].reps).toBe(18);
    expect(its[1].sets[0].reps).toBeNull();
  });

  it("pause stops the clock; continuing keeps the time left", () => {
    const start = startTimed(snap, items, at(0))!;
    const its = applied(items, start.sets);
    const paused = pause(start.timer!, at(10));
    expect(catchUp(snap, its, paused, at(500)).sets).toEqual([]);
    const resumed = resume(paused, at(100));
    // 30 s were left at the pause: the work ends at 1:40 + 0:30 = 2:10.
    expect(catchUp(snap, its, resumed, at(129)).sets).toEqual([]);
    expect(catchUp(snap, its, resumed, at(130)).sets[0]).toMatchObject({ id: "swing-0", duration_sec: 40 });
  });

  it("«Закончить раньше» ends the work now; «Начать сейчас» ends the rest now", () => {
    const start = startTimed(snap, items, at(0))!;
    let its = applied(items, start.sets);
    const early = finishEarly(snap, its, start.timer!, at(25));
    its = applied(its, early.sets);
    expect(its[0].sets[0]).toMatchObject({ duration_sec: 25 });
    expect(early.timer).toMatchObject({ phase: "rest", since: new Date(at(25)).toISOString(), we_id: "goblet" });
    const now = startNow(snap, its, early.timer!, at(30));
    its = applied(its, now.sets);
    expect(its[1].sets[0]).toMatchObject({ rest_sec: 5, rest_target_sec: 20 });
    expect(now.timer).toMatchObject({ phase: "work", we_id: "goblet", target_sec: 40 });
  });

  it("a skipped exercise is passed over", () => {
    const withSkip = [item("swing", "weight_reps"), item("goblet", "weight_reps", 3, true), item("push", "reps")];
    const start = startTimed(snap, withSkip, at(0))!;
    const c = catchUp(snap, applied(withSkip, start.sets), start.timer, at(41));
    expect(c.timer).toMatchObject({ phase: "rest", we_id: "push" });
  });
});
