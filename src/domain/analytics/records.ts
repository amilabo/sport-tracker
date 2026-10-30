import type { ExerciseSession } from "../chart-series";
import { formatNumber, plural } from "../format";
import { formatClock, formatSetsSummary } from "../sets";
import { formatKg } from "../summary";
import type { Id, IsoDateTime, LogType, WorkoutSet } from "../types";
import { bestE1rm, isTimedSet } from "./e1rm";
import { RECORDS_MIN_SESSIONS, USUAL_WEIGHT_SESSIONS } from "./thresholds";

// Records (stage 40, mockups А1, А2): counted from the workouts on the phone when the screen opens, nothing stored.
// A set on a timer (isTimedSet) gives no weight or volume record. Replacements count to the exercise actually done.

const RAZ: [string, string, string] = ["раз", "раза", "раз"];
const kg = (v: number) => formatNumber(v, 2);
const times = (v: number) => `${v} ${plural(v, RAZ)}`;

/** Done sets that count for weight and volume records. */
function counted(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.done_at && !isTimedSet(s));
}

/** The heaviest set (more reps wins a tie); weight > 0 only. */
function heaviest(sets: WorkoutSet[]): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null;
  for (const s of counted(sets)) {
    if (s.weight === null || s.weight <= 0) continue;
    const reps = s.reps ?? 0;
    if (!best || s.weight > best.weight || (s.weight === best.weight && reps > best.reps)) best = { weight: s.weight, reps };
  }
  return best;
}

/** Heaviest weight first, then reps — as one comparable number. */
function heaviestRank(sets: WorkoutSet[]): number | null {
  const h = heaviest(sets);
  return h && h.weight * 1000 + h.reps;
}

/** Σ weight × reps; null — nothing to sum. */
function volume(sets: WorkoutSet[]): number | null {
  const v = counted(sets).reduce((sum, s) => sum + (s.weight && s.weight > 0 && s.reps ? s.weight * s.reps : 0), 0);
  return v || null;
}

function maxReps(sets: WorkoutSet[]): number | null {
  const reps = sets.filter((s) => s.done_at && s.reps !== null).map((s) => s.reps!);
  return reps.length ? Math.max(...reps) : null;
}

function totalReps(sets: WorkoutSet[]): number | null {
  const done = sets.filter((s) => s.done_at && s.reps !== null);
  return done.length ? done.reduce((sum, s) => sum + s.reps!, 0) : null;
}

function longest(sets: WorkoutSet[]): number | null {
  const sec = sets.filter((s) => s.done_at && s.duration_sec !== null).map((s) => s.duration_sec!);
  return sec.length ? Math.max(...sec) : null;
}

/** Sessions oldest first: a record's date is the first workout that reached it. */
function chronological(sessions: ExerciseSession[]): ExerciseSession[] {
  return [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

type Best = { value: number; session: ExerciseSession };

/** The first session with the largest value; null — no session has one. */
function firstBest(sessions: ExerciseSession[], value: (sets: WorkoutSet[]) => number | null): Best | null {
  let best: Best | null = null;
  for (const s of chronological(sessions)) {
    const v = value(s.sets);
    if (v !== null && (!best || v > best.value)) best = { value: v, session: s };
  }
  return best;
}

/**
 * The working weight used most often in the latest workouts (the heavier one on a tie), other than `except` —
 * the best weight, whose reps «Лучший вес» already shows.
 */
export function usualWeight(sessions: ExerciseSession[], except: number | null = null): number | null {
  const count = new Map<number, number>();
  for (const s of chronological(sessions).slice(-USUAL_WEIGHT_SESSIONS)) {
    for (const set of counted(s.sets)) if (set.weight && set.weight > 0 && set.weight !== except) count.set(set.weight, (count.get(set.weight) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [w, n] of count) {
    const bn = best === null ? 0 : count.get(best)!;
    if (n > bn || (n === bn && w > best!)) best = w;
  }
  return best;
}

export interface ExerciseRecord {
  title: string;
  value: string;
  date: IsoDateTime;
  /** «4 × 10 × 22,5» under the volume record. */
  note?: string;
}

/** «Рекорды» on the exercise screen (А1). Empty below two workouts and for cardio. */
export function exerciseRecords(logType: LogType, sessions: ExerciseSession[]): ExerciseRecord[] {
  const done = sessions.filter((s) => s.sets.some((x) => x.done_at));
  if (done.length < RECORDS_MIN_SESSIONS) return [];
  const out: ExerciseRecord[] = [];
  const add = (title: string, best: Best | null, value: (v: number) => string, note?: (s: ExerciseSession) => string) => {
    if (best) out.push({ title, value: value(best.value), date: best.session.startedAt, ...(note ? { note: note(best.session) } : {}) });
  };
  const addHeaviest = (title: string, plus: string) => {
    const top = firstBest(done, heaviestRank);
    const h = top && heaviest(top.session.sets);
    if (top && h) out.push({ title, value: `${plus}${kg(h.weight)} кг × ${h.reps}`, date: top.session.startedAt });
    return h;
  };

  switch (logType) {
    case "weight_reps": {
      add("Расчётный максимум", firstBest(done, (sets) => bestE1rm(sets)?.value ?? null), (v) => `≈ ${kg(v)} кг`);
      const h = addHeaviest("Лучший вес", "");
      add("Объём за тренировку", firstBest(done, volume), (v) => `${formatKg(v)} кг`, (s) => formatSetsSummary("weight_reps", counted(s.sets)).replace(/ кг$/, ""));
      const usual = usualWeight(done, h?.weight ?? null);
      if (usual !== null) {
        add(`Больше всего раз с ${kg(usual)} кг`, firstBest(done, (sets) => maxReps(counted(sets).filter((x) => x.weight === usual))), times);
      }
      break;
    }
    case "bodyweight_plus":
      // Added weight once there is some; until then — reps.
      if (!addHeaviest("Лучший добавленный вес", "+")) add("Больше всего раз", firstBest(done, maxReps), times);
      break;
    case "reps":
      add("Больше всего раз за подход", firstBest(done, maxReps), times);
      add("Больше всего раз за тренировку", firstBest(done, totalReps), times);
      break;
    case "time":
      add("Самый долгий подход", firstBest(done, longest), formatClock);
      break;
    case "cardio":
      break;
  }
  return out;
}

export interface WorkoutRecord {
  exerciseId: Id;
  name: string;
  /** «лучший вес», «расчётный максимум», «объём за тренировку», «больше всего раз», «дольше всего». */
  kind: string;
  value: string;
  /** «+2,5 кг», «+3», «+0:15» — to the previous record. */
  delta: string;
}

export interface RecordItem {
  exerciseId: Id;
  name: string;
  logType: LogType;
  sets: WorkoutSet[];
}

function bestOf(sessions: ExerciseSession[], f: (sets: WorkoutSet[]) => number | null): number | null {
  const values = sessions.map((s) => f(s.sets)).filter((v): v is number => v !== null);
  return values.length ? Math.max(...values) : null;
}

const beats = (cur: number | null, prev: number | null): boolean => cur !== null && prev !== null && cur > prev;

type Line = Omit<WorkoutRecord, "exerciseId" | "name">;

function repsLine(sets: WorkoutSet[], history: ExerciseSession[]): Line | null {
  const r = maxReps(sets);
  const prev = bestOf(history, maxReps);
  return beats(r, prev) ? { kind: "больше всего раз", value: times(r!), delta: `+${r! - prev!}` } : null;
}

/** One record line of an exercise, or null: the first kind it beats, in priority order. */
function recordOf(item: RecordItem, history: ExerciseSession[]): Line | null {
  const sets = item.sets;
  switch (item.logType) {
    case "weight_reps": {
      const cur = heaviest(sets);
      const prev = bestOf(history, (x) => heaviest(x)?.weight ?? null);
      if (cur && beats(cur.weight, prev)) return { kind: "лучший вес", value: `${kg(cur.weight)} кг × ${cur.reps}`, delta: `+${kg(cur.weight - prev!)} кг` };
      const e = bestE1rm(sets)?.value ?? null;
      const prevE = bestOf(history, (x) => bestE1rm(x)?.value ?? null);
      if (beats(e, prevE)) return { kind: "расчётный максимум", value: `≈ ${kg(e!)} кг`, delta: `+${kg(e! - prevE!)} кг` };
      const v = volume(sets);
      const prevV = bestOf(history, volume);
      if (beats(v, prevV)) return { kind: "объём за тренировку", value: `${formatKg(v!)} кг`, delta: `+${formatKg(v! - prevV!)} кг` };
      return null;
    }
    case "bodyweight_plus": {
      const cur = heaviest(sets);
      const prev = bestOf(history, (x) => heaviest(x)?.weight ?? null);
      // The first added weight beats «own weight only» (0 kg) too.
      if (cur && cur.weight > (prev ?? 0)) return { kind: "лучший вес", value: `+${kg(cur.weight)} кг × ${cur.reps}`, delta: `+${kg(cur.weight - (prev ?? 0))} кг` };
      return cur || prev !== null ? null : repsLine(sets, history);
    }
    case "reps":
      return repsLine(sets, history);
    case "time": {
      const t = longest(sets);
      const prev = bestOf(history, longest);
      return beats(t, prev) ? { kind: "дольше всего", value: formatClock(t!), delta: `+${formatClock(t! - prev!)}` } : null;
    }
    case "cardio":
      return null;
  }
}

/**
 * Records of this workout against all the history before it (А2): at most one line per exercise, by priority
 * best weight → ≈ максимум → volume. The first workout with an exercise sets no record — there is nothing to beat.
 * `history` — completed sessions of the exercises, started before this workout.
 */
export function workoutRecords(items: RecordItem[], history: Map<Id, ExerciseSession[]>): WorkoutRecord[] {
  // One exercise twice in a workout (added again, or a replacement) counts as one.
  const merged = new Map<Id, RecordItem>();
  for (const it of items) {
    const prev = merged.get(it.exerciseId);
    merged.set(it.exerciseId, prev ? { ...prev, sets: [...prev.sets, ...it.sets] } : it);
  }
  const out: WorkoutRecord[] = [];
  for (const it of merged.values()) {
    const past = (history.get(it.exerciseId) ?? []).filter((s) => s.sets.some((x) => x.done_at));
    if (!past.length || !it.sets.some((s) => s.done_at)) continue;
    const line = recordOf(it, past);
    if (line) out.push({ exerciseId: it.exerciseId, name: it.name, ...line });
  }
  return out;
}

/** «7 рекордов», «Ещё 4 рекорда». */
export function recordsWord(n: number): string {
  return plural(n, ["рекорд", "рекорда", "рекордов"]);
}
