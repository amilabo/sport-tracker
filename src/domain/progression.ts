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

export interface ChainLevelSeries {
  exercise: Exercise;
  level: number;
  /** The level's workouts in date order; `norm` — 0…1 inside the level's band, 1 — its best. */
  points: { t: number; value: number; norm: number; workoutId: string }[];
}

export interface ChainSeries {
  /** Easiest first, every member — a level without workouts has no points. */
  levels: ChainLevelSeries[];
  /** First and last workout of the chain, ms; null — none yet. */
  from: number | null;
  to: number | null;
  /** The level done most recently and when it was first done. */
  current: { level: number; since: IsoDateTime } | null;
}

/**
 * «Вся прогрессия» on one chart (stage 45, mockup А7): a band per level; inside a band each workout's result as on the
 * exercise's own chart (`pointFor`: assistance is negative, so «less assistance» is higher by itself), scaled between
 * the level's worst and best. Transitions come from the order of the levels.
 */
export function chainSeries(members: Exercise[], sessions: ChainSession[]): ChainSeries {
  const levels = members.map((exercise, i) => {
    const raw = chartSeries(exercise.log_type, sessions.filter((s) => s.exerciseId === exercise.id));
    const values = raw.map((p) => p.value);
    const lo = Math.min(...values), hi = Math.max(...values);
    return {
      exercise,
      level: i + 1,
      points: raw.map((p) => ({ t: new Date(p.date).getTime(), value: p.value, norm: hi === lo ? 0.5 : (p.value - lo) / (hi - lo), workoutId: p.workoutId })),
    };
  });
  const all = levels.flatMap((l) => l.points.map((p) => p.t));
  const latest = [...sessions].filter((s) => members.some((m) => m.id === s.exerciseId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const currentLevel = latest ? levels.find((l) => l.exercise.id === latest.exerciseId) : undefined;
  return {
    levels,
    from: all.length ? Math.min(...all) : null,
    to: all.length ? Math.max(...all) : null,
    current: currentLevel?.points.length ? { level: currentLevel.level, since: new Date(currentLevel.points[0].t).toISOString() } : null,
  };
}
