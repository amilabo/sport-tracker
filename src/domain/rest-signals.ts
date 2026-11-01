// APK A5 (apk/docs/a5-a7-design.md, mockup С2): what the phone shows and signals by itself while the app is away
// during a rest. Built from the same RestTimer as the panel; a circuit by time is replayed ahead phase by phase.
import { formatRest } from "./rest";
import { remainingSec } from "./rest-timer";
import { phasesAhead, timedCircuit, workSecFor, type TimedItem } from "./timed-circuit";
import type { Exercise, RestSnapshot, RestTimer } from "./types";

export type SignalItem = TimedItem & { exercise: Pick<Exercise, "name" | "log_type"> };

export interface RestSignal {
  /** When this notification replaces the one before, ms. */
  at: number;
  title: string;
  text: string;
  /** The countdown runs to this moment, ms; null — no countdown. */
  until: number | null;
  /** Three beeps and a vibration (the phase changed, «Пора»); false — shown quietly. */
  alert: boolean;
}

export const KIND_LABELS: Record<RestTimer["kind"], string> = {
  set: "Отдых между подходами",
  exercise: "Отдых между упражнениями",
  inside: "Отдых в круге",
  round: "Отдых между кругами",
};

/** «Жим лёжа, подход 3»; in a circuit — «Отжимания, круг 2 из 3». */
export function setTitle(items: SignalItem[], timer: Pick<RestTimer, "we_id" | "set_id">): string {
  const item = items.find((it) => it.we.id === timer.we_id);
  const si = item ? item.sets.findIndex((s) => s.id === timer.set_id) : -1;
  if (!item || si < 0) return "";
  return item.we.circuit_id ? `${item.exercise.name}, круг ${si + 1} из ${item.sets.length}` : `${item.exercise.name}, подход ${si + 1}`;
}

/** What follows the work in a circuit by time: «Дальше: отдых 0:20 → Отжимания» or «Дальше: конец круга». */
export function afterWork(items: SignalItem[], timer: Pick<RestTimer, "we_id" | "set_id">, circuit: { id: string; rest_inside_sec: number; rest_round_sec: number }): string {
  const target = items.find((it) => it.we.id === timer.we_id);
  if (!target) return "";
  const members = items.filter((it) => it.we.circuit_id === circuit.id && !it.we.skipped);
  const si = target.sets.findIndex((s) => s.id === timer.set_id);
  const pos = members.findIndex((m) => m.we.id === target.we.id);
  const lastInRound = pos === members.length - 1;
  const lastRound = si === Math.max(...members.map((m) => m.sets.length)) - 1;
  if (lastInRound && lastRound) return "Дальше: конец круга";
  const nextName = lastInRound ? members[0]?.exercise.name : members[pos + 1]?.exercise.name;
  const restSec = lastInRound ? circuit.rest_round_sec : circuit.rest_inside_sec;
  return `Дальше: ${restSec > 0 ? `отдых ${formatRest(restSec)} → ` : ""}${nextName}`;
}

/** The notification of a phase that has just begun at `at`. */
function phaseSignal(snapshot: RestSnapshot, items: SignalItem[], timer: RestTimer | null, at: number, alert: boolean): RestSignal[] {
  if (!timer) return [{ at, title: "Круг закончен", text: "Тренировка ждёт в приложении", until: null, alert }];
  const end = Date.parse(timer.since) + timer.target_sec * 1000;
  const item = items.find((it) => it.we.id === timer.we_id);
  const circuit = timedCircuit(snapshot, item?.we.circuit_id);
  if (timer.phase === "work") {
    if (!circuit || !item) return [];
    const si = item.sets.findIndex((s) => s.id === timer.set_id);
    const tail = afterWork(items, timer, circuit);
    return [{ at, title: `Работа · ${item.exercise.name}`, text: `Круг ${si + 1} из ${item.sets.length}. ${tail}`, until: end, alert }];
  }
  const next = setTitle(items, timer);
  const auto = !!workSecFor(snapshot, item) && (timer.kind === "inside" || timer.kind === "round");
  if (auto) return [{ at, title: KIND_LABELS[timer.kind], text: `Дальше: ${next}`, until: end, alert }];
  // A rest that ends with «Пора» and waits for «Начать подход».
  return [
    { at, title: KIND_LABELS[timer.kind], text: `Дальше: ${next} · из ${formatRest(timer.target_sec)}`, until: end, alert },
    { at: end, title: `Пора: ${next}`, text: `Отдых ${formatRest(timer.target_sec)} закончился`, until: null, alert: true },
  ];
}

/**
 * Everything to show from `now` on if the app leaves the screen now, in time order. The first one is shown at once
 * (quietly), the rest come by themselves. Empty — nothing runs: no timer, «Пауза», a set without a clock, or the rest is
 * already over («Пора» was given on screen).
 */
export function restSignals(snapshot: RestSnapshot | undefined, items: SignalItem[], timer: RestTimer | null | undefined, now: number): RestSignal[] {
  if (!snapshot || !timer || timer.paused_at) return [];
  const item = items.find((it) => it.we.id === timer.we_id);
  const timed = !!workSecFor(snapshot, item);
  if (!timed && timer.phase === "work") return [];
  if (remainingSec(timer, now) <= 0) return [];
  const out = phaseSignal(snapshot, items, timer, now, false);
  if (!timed) return out;
  for (const p of phasesAhead(snapshot, items, timer)) out.push(...phaseSignal(snapshot, p.items as SignalItem[], p.timer, p.at, true));
  return out;
}
