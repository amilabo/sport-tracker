import { describe, expect, it } from "vitest";
import { restSignals, type SignalItem } from "./rest-signals";
import { pause, startTimed } from "./timed-circuit";
import type { LogType, RestSnapshot, RestTimer, WorkoutSet } from "./types";
import { newWorkoutExercise, newWorkoutSet } from "./workout";

const T0 = Date.parse("2026-11-01T10:00:00.000Z");
const at = (sec: number) => T0 + sec * 1000;
const iso = (sec: number) => new Date(at(sec)).toISOString();

function item(id: string, name: string, rounds: number, circuit: string | null = null, logType: LogType = "weight_reps", doneSets = 0): SignalItem {
  const we = { ...newWorkoutExercise("w", id, 0, undefined, circuit), id };
  const sets: WorkoutSet[] = Array.from({ length: rounds }, (_, i) => ({
    ...newWorkoutSet(we.id, i, { weight: 50, reps: 8, duration_sec: null, speed_kmh: null }),
    id: `${id}-${i}`,
    done_at: i < doneSets ? iso(0) : null,
  }));
  return { we, exercise: { name, log_type: logType }, sets };
}

describe("restSignals — a rest that ends with «Пора»", () => {
  const snap: RestSnapshot = { format: "rest", rest_set_sec: 90, rest_exercise_sec: 120 };
  const items = [item("bench", "Жим лёжа", 3, null, "weight_reps", 2)];
  const timer: RestTimer = { phase: "rest", since: iso(0), target_sec: 90, kind: "set", we_id: "bench", set_id: "bench-2", from_we_id: "bench", from_set_id: "bench-1" };

  it("the countdown at once, then «Пора» at the end (mockup С2)", () => {
    expect(restSignals(snap, items, timer, at(18))).toEqual([
      { at: at(18), title: "Отдых между подходами", text: "Дальше: Жим лёжа, подход 3 · из 1:30", until: at(90), alert: false },
      { at: at(90), title: "Пора: Жим лёжа, подход 3", text: "Отдых 1:30 закончился", until: null, alert: true },
    ]);
  });

  it("nothing when the rest is over, paused, or a set is being done", () => {
    expect(restSignals(snap, items, timer, at(90))).toEqual([]);
    expect(restSignals(snap, items, pause(timer, at(10)), at(20))).toEqual([]);
    expect(restSignals(snap, items, { ...timer, phase: "work", target_sec: 0 }, at(20))).toEqual([]);
    expect(restSignals(snap, items, null, at(20))).toEqual([]);
  });
});

describe("restSignals — a circuit by time", () => {
  const CID = "c";
  const snap: RestSnapshot = {
    format: "circuit",
    rest_set_sec: 60,
    rest_exercise_sec: 120,
    circuits: [{ id: CID, rounds: 2, rest_inside_sec: 15, rest_round_sec: 60, mode: "timed", work_sec: 40 }],
  };
  const items = [item("squat", "Приседания", 2, CID, "reps"), item("push", "Отжимания", 2, CID, "reps")];

  it("a notification for every phase, each with its countdown; the end of the circuit is the last", () => {
    const start = startTimed(snap, items, at(0))!;
    const its = items.map((it) => ({ ...it, sets: it.sets.map((s) => start.sets.find((x) => x.id === s.id) ?? s) }));
    const out = restSignals(snap, its, start.timer, at(12));
    expect(out.map((s) => [s.at - T0, s.title, s.alert])).toEqual([
      [12000, "Работа · Приседания", false],
      [40000, "Отдых в круге", true],
      [55000, "Работа · Отжимания", true],
      [95000, "Отдых между кругами", true],
      [155000, "Работа · Приседания", true],
      [195000, "Отдых в круге", true],
      [210000, "Работа · Отжимания", true],
      [250000, "Круг закончен", true],
    ]);
    expect(out[0]).toMatchObject({ text: "Круг 1 из 2. Дальше: отдых 0:15 → Отжимания", until: at(40) });
    expect(out[1]).toMatchObject({ text: "Дальше: Отжимания, круг 1 из 2", until: at(55) });
    expect(out[6]).toMatchObject({ text: "Круг 2 из 2. Дальше: конец круга", until: at(250) });
    expect(out[7].until).toBeNull();
  });
});
