import { chartSeries, formatValue } from "./chart-series";
import type { Exercise, Id, IsoDateTime, WorkoutSet } from "./types";

// Progressions (PRD §3.1.2): a named chain of exercise variants ordered by difficulty, level 1 = easiest.

/** Inserts newId right before (easier) or after (harder) the anchor in an easiest-first order. */
export function insertLevel(order: Id[], anchorId: Id, newId: Id, side: "easier" | "harder"): Id[] {
  const rest = order.filter((id) => id !== newId);
  const i = rest.indexOf(anchorId);
  if (i < 0) throw new Error("anchor not in chain");
  rest.splice(side === "easier" ? i : i + 1, 0, newId);
  return rest;
}

/** Moves one level up (harder, +1) or down (easier, −1); unchanged at the ends. */
export function moveLevel(order: Id[], id: Id, dir: 1 | -1): Id[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export interface ChainSession {
  workoutId: string;
  startedAt: IsoDateTime;
  exerciseId: Id;
  sets: WorkoutSet[];
}

export type TimelineItem =
  | { kind: "row"; session: ChainSession; exercise: Exercise }
  | { kind: "transition"; date: IsoDateTime; exercise: Exercise };

/**
 * All variants' workouts, newest first, with a transition mark under the first workout on each harder level:
 * «10 июля — переход на «Подтягивания с резинкой»». The easiest level that was done has no mark.
 */
export function chainTimeline(members: Exercise[], sessions: ChainSession[]): TimelineItem[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const levelOf = new Map(members.map((m, i) => [m.id, i]));
  const done = sessions.filter((s) => byId.has(s.exerciseId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const firstOf = new Map<Id, ChainSession>();
  for (const s of done) firstOf.set(s.exerciseId, s); // newest first, so the last write is the earliest
  const startLevel = Math.min(...[...firstOf.keys()].map((id) => levelOf.get(id)!));

  const items: TimelineItem[] = [];
  for (const s of done) {
    const exercise = byId.get(s.exerciseId)!;
    items.push({ kind: "row", session: s, exercise });
    if (firstOf.get(s.exerciseId) === s && levelOf.get(s.exerciseId)! > startLevel) {
      items.push({ kind: "transition", date: s.startedAt, exercise });
    }
  }
  return items;
}

export type LevelState = "passed" | "current" | "goal" | "none";

export interface LevelInfo {
  exercise: Exercise;
  level: number;
  state: LevelState;
  firstAt: IsoDateTime | null;
  lastAt: IsoDateTime | null;
  /** "8 → 12 раз" from the first to the last workout, or the single result. */
  range: string | null;
}

/** The current level is the one done most recently; easier ones are passed, harder ones are goals. */
export function levelInfo(members: Exercise[], sessions: ChainSession[]): LevelInfo[] {
  const latest = [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const currentIndex = latest ? members.findIndex((m) => m.id === latest.exerciseId) : -1;
  return members.map((exercise, i) => {
    const own = sessions.filter((s) => s.exerciseId === exercise.id);
    const points = chartSeries(exercise.log_type, own);
    const first = points[0];
    const last = points.at(-1);
    const range = !first ? null : first === last ? formatValue(exercise.log_type, first.value) : `${formatValue(exercise.log_type, first.value)} → ${formatValue(exercise.log_type, last!.value)}`;
    const dates = own.map((s) => s.startedAt).sort();
    return {
      exercise,
      level: i + 1,
      state: currentIndex < 0 ? "none" : i === currentIndex ? "current" : i < currentIndex ? "passed" : "goal",
      firstAt: dates[0] ?? null,
      lastAt: dates.at(-1) ?? null,
      range,
    };
  });
}
