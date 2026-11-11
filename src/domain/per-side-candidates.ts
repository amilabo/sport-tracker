import { isOneSideCatalog } from "@/content/exercise-one-side";
import { perSide } from "./analytics/progress-settings";
import type { Exercise, Id } from "./types";

// «На каждую сторону?» (stage 53, mockup Р6): asked once after the update — which exercises of the plans are done one
// side at a time. Checked beforehand: already set, a note of the plan saying so, the catalog. Listed but not checked:
// 20+ reps in the plan — maybe the sum of both sides.

export type PerSideReason = "set" | "note" | "catalog" | "reps";

export interface PerSideCandidate {
  exercise: Exercise;
  reason: PerSideReason;
  /** The note with «каждую…» or the reps in the plan, for the grey line. */
  detail: string | null;
  checked: boolean;
}

export interface PlanLine {
  exercise: Exercise;
  note: string | null;
  /** Reps of the plan's sets. */
  reps: (number | null)[];
}

/** Reps this high in a plan may be the sum of both sides. */
export const PER_SIDE_REPS_HINT = 20;
const NOTE = /кажд|на\s+(ногу|руку|сторону)|по\s+\d+\s+на\s/i;

const RANK: Record<PerSideReason, number> = { set: 0, note: 1, catalog: 2, reps: 3 };

/** Exercises of the plans to ask about, checked ones first; each exercise once, by its strongest reason. */
export function perSideCandidates(lines: PlanLine[]): PerSideCandidate[] {
  const best = new Map<Id, PerSideCandidate>();
  for (const { exercise, note, reps } of lines) {
    if (exercise.log_type !== "weight_reps" && exercise.log_type !== "reps") continue;
    const maxReps = Math.max(0, ...reps.map((r) => r ?? 0));
    let c: PerSideCandidate | null = null;
    if (perSide(exercise)) c = { exercise, reason: "set", detail: null, checked: true };
    else if (note && NOTE.test(note)) c = { exercise, reason: "note", detail: note.trim(), checked: true };
    else if (isOneSideCatalog(exercise)) c = { exercise, reason: "catalog", detail: null, checked: true };
    else if (maxReps >= PER_SIDE_REPS_HINT) c = { exercise, reason: "reps", detail: String(maxReps), checked: false };
    if (!c) continue;
    const prev = best.get(exercise.id);
    if (!prev || RANK[c.reason] < RANK[prev.reason]) best.set(exercise.id, c);
  }
  return [...best.values()].sort((a, b) => RANK[a.reason] - RANK[b.reason] || a.exercise.name.localeCompare(b.exercise.name, "ru"));
}

/** The grey line under the name. */
export function perSideWhy(c: PerSideCandidate): string {
  switch (c.reason) {
    case "set":
      return "уже отмечено";
    case "note": {
      const note = c.detail ?? "";
      return `в заметке: «${note.length > 48 ? `${note.slice(0, 47)}…` : note}»`;
    }
    case "catalog":
      return "в каталоге — на каждую сторону";
    case "reps":
      return `в плане ${c.detail} раз — возможно, сумма?`;
  }
}
