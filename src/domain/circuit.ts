// Circuits (stage 36): exercises done round by round. A circuit is plain sets: every member has as many sets
// as there are rounds, set i is round i — so history, charts and backups need nothing new.
import { cleanRest } from "./rest";
import type { Id, PlanCircuit, PlanFormat, SetValues } from "./types";

/** The circuit of a «Круговая» plan: all its exercises, whatever their own circuit ids say. */
export const WHOLE_CIRCUIT_ID = "all";
export const CIRCUIT_DEFAULTS = { rounds: 3, rest_inside_sec: 15, rest_round_sec: 90 } as const;
/** «По времени» (stage 39, mockup Т1): 0:40 of work, 0:20 between exercises. */
export const TIMED_DEFAULTS = { work_sec: 40, rest_inside_sec: 20 } as const;
export const MAX_ROUNDS = 20;

export function newCircuit(id: Id, rounds: number = CIRCUIT_DEFAULTS.rounds): PlanCircuit {
  return { id, rounds: clampRounds(rounds), rest_inside_sec: CIRCUIT_DEFAULTS.rest_inside_sec, rest_round_sec: CIRCUIT_DEFAULTS.rest_round_sec };
}

export function clampRounds(n: number): number {
  return Math.max(1, Math.min(MAX_ROUNDS, Math.round(n) || 1));
}

/** Stored circuits as a clean list: broken entries (from an imported file) are dropped. */
export function cleanCircuits(value: unknown): PlanCircuit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is PlanCircuit => !!c && typeof c === "object" && typeof (c as PlanCircuit).id === "string")
    .map((c) => {
      const out: PlanCircuit = {
        id: c.id,
        rounds: clampRounds(Number(c.rounds)),
        rest_inside_sec: cleanRest(c.rest_inside_sec) ?? CIRCUIT_DEFAULTS.rest_inside_sec,
        rest_round_sec: cleanRest(c.rest_round_sec) ?? CIRCUIT_DEFAULTS.rest_round_sec,
      };
      // «По времени» keeps its work time; a circuit by reps stays without the fields (older versions see nothing new).
      if (c.mode === "timed") {
        out.mode = "timed";
        out.work_sec = Math.max(5, cleanRest(c.work_sec) ?? TIMED_DEFAULTS.work_sec);
      }
      return out;
    });
}

/**
 * The circuit an exercise is in, by plan type: «Круговая» — the whole-plan circuit; «С отдыхом» — its own group,
 * if that circuit exists; «Силовая» — none (circuits are kept, but not used).
 */
export function circuitIdFor(format: PlanFormat, ownId: Id | null | undefined, circuits: PlanCircuit[]): Id | null {
  if (format === "circuit") return WHOLE_CIRCUIT_ID;
  if (format !== "rest" || !ownId) return null;
  return circuits.some((c) => c.id === ownId) ? ownId : null;
}

/** «Круговая» always has its circuit; a missing one is made with defaults, rounds — by the most sets. */
export function wholeCircuit(circuits: PlanCircuit[], setCounts: number[]): PlanCircuit {
  return circuits.find((c) => c.id === WHOLE_CIRCUIT_ID) ?? newCircuit(WHOLE_CIRCUIT_ID, Math.max(CIRCUIT_DEFAULTS.rounds, ...setCounts));
}

/** Sets cut or extended to `n` rounds; a new round copies the last set. */
export function alignSets<T extends SetValues>(sets: T[], n: number, blank: () => T): T[] {
  if (sets.length >= n) return sets.slice(0, n);
  const out = sets.slice();
  while (out.length < n) {
    const last = out.at(-1);
    out.push(last ? ({ ...last, id: undefined } as T) : blank());
  }
  return out;
}

/**
 * Groups of «С отдыхом» must be runs of neighbours with 2+ exercises. After a move or a removal, a member that
 * got separated from its group, or a group left with one exercise, leaves the circuit.
 */
export function tidyGroups<T extends { circuit_id: Id | null }>(rows: T[]): T[] {
  const seen = new Set<Id>();
  const out = rows.map((r, i) => {
    const id = r.circuit_id;
    if (!id) return r;
    const continues = i > 0 && rows[i - 1].circuit_id === id;
    if (!continues && seen.has(id)) return { ...r, circuit_id: null };
    seen.add(id);
    return r;
  });
  return out.map((r) => {
    const id = r.circuit_id;
    if (!id) return r;
    const size = out.filter((x) => x.circuit_id === id).length;
    return size >= 2 ? r : { ...r, circuit_id: null };
  });
}

/** Circuits that some exercise still uses (plus the whole-plan one); unused groups are dropped on save. */
export function usedCircuits(circuits: PlanCircuit[], rowIds: (Id | null)[]): PlanCircuit[] {
  const used = new Set(rowIds.filter(Boolean));
  return circuits.filter((c) => c.id === WHOLE_CIRCUIT_ID || used.has(c.id));
}

type CircuitItem = { we: { circuit_id?: Id | null; skipped: boolean }; sets: { done_at: string | null }[] };

/** The member to do now: the first undone set, round by round (round 1 of all members, then round 2…). */
export function circuitCurrent(items: CircuitItem[], circuitId: Id): number {
  const members = items.map((it, i) => ({ it, i })).filter(({ it }) => it.we.circuit_id === circuitId && !it.we.skipped);
  const rounds = Math.max(0, ...members.map(({ it }) => it.sets.length));
  for (let r = 0; r < rounds; r++) {
    const m = members.find(({ it }) => it.sets[r] && !it.sets[r].done_at);
    if (m) return m.i;
  }
  return -1;
}

/** «Круг 2 из 3»: the first round with an undone set of a not skipped member; done — all rounds. */
export function circuitProgress(items: CircuitItem[], circuitId: Id): { round: number; rounds: number; done: boolean } {
  const members = items.filter((it) => it.we.circuit_id === circuitId);
  const rounds = Math.max(0, ...members.map((m) => m.sets.length));
  for (let r = 0; r < rounds; r++) {
    if (members.some((m) => !m.we.skipped && m.sets[r] && !m.sets[r].done_at)) return { round: r + 1, rounds, done: false };
  }
  return { round: rounds, rounds, done: true };
}
