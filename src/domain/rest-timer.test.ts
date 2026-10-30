import { describe, expect, it } from "vitest";
import { adjustRest, elapsedSec, formatCountdown, nextSet, remainingSec, restAfter, restRecord, startWork } from "./rest-timer";
import type { RestSnapshot } from "./types";

const SNAP: RestSnapshot = { format: "rest", rest_set_sec: 60, rest_exercise_sec: 120 };
const AT = "2026-10-30T10:00:00.000Z";
const at = (sec: number) => new Date(Date.parse(AT) + sec * 1000).toISOString();

function item(id: string, done: boolean[], opts: { skipped?: boolean; rest?: number | null } = {}) {
  return {
    we: { id, skipped: opts.skipped ?? false, rest_set_sec: opts.rest ?? null },
    sets: done.map((d, i) => ({ id: `${id}${i + 1}`, done_at: d ? AT : null })),
  };
}

describe("nextSet", () => {
  it("an undone set of the same exercise comes first", () => {
    expect(nextSet([item("a", [true, false, false]), item("b", [false])], 0)).toEqual({ index: 0, setIndex: 1, kind: "set" });
  });

  it("then the next exercises, skipping skipped ones, then the ones left above", () => {
    const items = [item("a", [false]), item("b", [true, true]), item("c", [false], { skipped: true }), item("d", [true])];
    expect(nextSet(items, 1)).toEqual({ index: 0, setIndex: 0, kind: "exercise" });
    expect(nextSet([item("a", [true]), item("b", [true])], 0)).toBeNull();
  });
});

describe("restAfter", () => {
  it("between sets — the exercise's own rest, else the plan's", () => {
    const t = restAfter(SNAP, [item("a", [true, false], { rest: 150 })], 0, AT, "a1")!;
    expect(t).toMatchObject({ phase: "rest", kind: "set", target_sec: 150, we_id: "a", set_id: "a2", from_set_id: "a1", since: AT });
    expect(restAfter(SNAP, [item("a", [true, false])], 0, AT, "a1")!.target_sec).toBe(60);
  });

  it("after the last set — rest between exercises before the next one", () => {
    const t = restAfter(SNAP, [item("a", [true, true]), item("b", [false, false])], 0, AT, "a2")!;
    expect(t).toMatchObject({ kind: "exercise", target_sec: 120, we_id: "b", set_id: "b1" });
  });

  it("no timer when everything is done or the rest is 0:00", () => {
    expect(restAfter(SNAP, [item("a", [true])], 0, AT, "a1")).toBeNull();
    expect(restAfter({ ...SNAP, rest_set_sec: 0 }, [item("a", [true, false])], 0, AT, "a1")).toBeNull();
  });
});

describe("counting", () => {
  const t = restAfter(SNAP, [item("a", [true, false])], 0, AT, "a1")!;

  it("counts from the moment, not from ticks", () => {
    expect(remainingSec(t, Date.parse(at(48)))).toBe(12);
    expect(remainingSec(t, Date.parse(at(84)))).toBe(-24);
    expect(formatCountdown(12)).toBe("0:12");
    expect(formatCountdown(-84)).toBe("+1:24");
  });

  it("−/+ 15 s changes only today's rest, never below zero", () => {
    expect(adjustRest(t, 1).target_sec).toBe(75);
    expect(adjustRest({ ...t, target_sec: 10 }, -1).target_sec).toBe(0);
  });

  it("records the rest exactly on «Начать подход», approximately on a tick", () => {
    expect(restRecord(t, at(95), false)).toEqual({ rest_sec: 95, rest_target_sec: 60 });
    expect(restRecord(t, at(130), true)).toEqual({ rest_sec: 130, rest_target_sec: 60, rest_approx: true });
    const work = startWork(t, at(95));
    expect(work).toMatchObject({ phase: "work", since: at(95), set_id: "a2" });
    expect(elapsedSec(work, Date.parse(at(125)))).toBe(30);
  });
});
