import { describe, expect, it } from "vitest";
import { alignSets, circuitCurrent, circuitIdFor, circuitProgress, cleanCircuits, tidyGroups, WHOLE_CIRCUIT_ID, wholeCircuit } from "./circuit";
import { nextSet, restAfter } from "./rest-timer";
import type { RestSnapshot, SetValues } from "./types";

const blank = (): SetValues => ({ weight: null, reps: null, duration_sec: null, speed_kmh: null });
const set = (reps: number): SetValues => ({ ...blank(), reps });

describe("circuit plan helpers", () => {
  it("sets follow the rounds: a new round copies the last set, extra ones go", () => {
    expect(alignSets([set(10), set(12)], 3, blank).map((s) => s.reps)).toEqual([10, 12, 12]);
    expect(alignSets([set(10), set(12), set(14)], 1, blank).map((s) => s.reps)).toEqual([10]);
  });

  it("the circuit of an exercise depends on the plan type", () => {
    const circuits = cleanCircuits([{ id: "g", rounds: 3, rest_inside_sec: 15, rest_round_sec: 90 }]);
    expect(circuitIdFor("circuit", null, circuits)).toBe(WHOLE_CIRCUIT_ID);
    expect(circuitIdFor("rest", "g", circuits)).toBe("g");
    expect(circuitIdFor("rest", "missing", circuits)).toBeNull();
    expect(circuitIdFor("strength", "g", circuits)).toBeNull();
  });

  it("broken circuits from a file are cleaned; «Круговая» gets defaults by the most sets", () => {
    expect(cleanCircuits([{ id: "g", rounds: "x", rest_inside_sec: -1 }, null, 5])).toEqual([
      { id: "g", rounds: 1, rest_inside_sec: 15, rest_round_sec: 90 },
    ]);
    expect(wholeCircuit([], [2, 4])).toMatchObject({ id: WHOLE_CIRCUIT_ID, rounds: 4 });
  });

  it("a separated member or a group of one leaves the circuit", () => {
    const rows = [{ circuit_id: "g" }, { circuit_id: null }, { circuit_id: "g" }, { circuit_id: "h" }, { circuit_id: "h" }];
    expect(tidyGroups(rows).map((r) => r.circuit_id)).toEqual([null, null, null, "h", "h"]);
  });
});

const SNAP: RestSnapshot = {
  format: "rest",
  rest_set_sec: 60,
  rest_exercise_sec: 120,
  circuits: [{ id: "c", rounds: 2, rest_inside_sec: 15, rest_round_sec: 90 }],
};
const AT = "2026-10-30T10:00:00.000Z";

function item(id: string, done: boolean[], circuit_id?: string) {
  return { we: { id, skipped: false, rest_set_sec: null, circuit_id }, sets: done.map((d, i) => ({ id: `${id}${i + 1}`, done_at: d ? AT : null })) };
}

describe("circuit in the gym", () => {
  // Plain exercise, then a circuit of two (2 rounds), then a plain exercise.
  const plan = (a: boolean[], b: boolean[], c: boolean[], d: boolean[] = [false]) => [item("x", a), item("b", b, "c"), item("p", c, "c"), item("z", d)];

  it("round by round: next member of the round, then the next round", () => {
    expect(nextSet(plan([true], [true, false], [false, false]), 1, 0)).toEqual({ index: 2, setIndex: 0, kind: "inside" });
    expect(nextSet(plan([true], [true, false], [true, false]), 2, 0)).toEqual({ index: 1, setIndex: 1, kind: "round" });
  });

  it("rest inside a round and between rounds come from the circuit", () => {
    expect(restAfter(SNAP, plan([true], [true, false], [false, false]), 1, AT, "b1")!.target_sec).toBe(15);
    expect(restAfter(SNAP, plan([true], [true, false], [true, false]), 2, AT, "p1")!.target_sec).toBe(90);
  });

  it("entering a circuit starts at its first undone set; after the last round — the next exercise", () => {
    expect(nextSet(plan([true], [false, false], [false, false]), 0, 0)).toEqual({ index: 1, setIndex: 0, kind: "exercise" });
    expect(nextSet(plan([true], [true, true], [true, true]), 2, 1)).toEqual({ index: 3, setIndex: 0, kind: "exercise" });
  });

  it("«Круг 2 из 3» and the exercise to do now", () => {
    const items = plan([true], [true, false], [true, false]);
    expect(circuitProgress(items, "c")).toEqual({ round: 2, rounds: 2, done: false });
    expect(circuitCurrent(items, "c")).toBe(1);
    expect(circuitProgress(plan([true], [true, true], [true, true]), "c")).toMatchObject({ done: true });
  });
});
