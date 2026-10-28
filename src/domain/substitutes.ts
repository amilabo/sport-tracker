import type { Relation } from "@/content/exercise-substitutes";
import type { CatalogSub } from "@/content/substitutes";
import { formatDayMonth } from "./format";
import { RELATION_LABELS } from "./labels";
import { formatSetsSummary } from "./sets";
import { compareRu } from "./text";
import type { Exercise, Id, IsoDateTime, SetValues } from "./types";

// «Чем заменить» (docs/substitutes-architecture.md): which exercises to offer instead of one, in which order.
// Pure: the repository gathers the input, the gym sheet and the exercise screen show the result.

export interface PastResult {
  at: IsoDateTime;
  sets: SetValues[];
}

/** The exercise was replaced by `exerciseId` in a completed workout. */
export interface PastReplacement extends PastResult {
  exerciseId: Id;
}

export interface SubstituteInput {
  /** The exercise to replace: the plan's one, even if it is already replaced today. */
  target: Exercise;
  /** Every exercise; archived ones are never offered. */
  exercises: Exercise[];
  /** From the reference, in order of priority; none for an own exercise. */
  catalog: CatalogSub[];
  /** The progression the target is in, members from easiest to hardest. */
  chain: { name: string; members: Exercise[] } | null;
  /** Newest first. */
  replaced: PastReplacement[];
  /** The latest completed result of each exercise that has one. */
  last: Map<Id, PastResult>;
  /** Exercises already in today's workout. */
  excludeIds?: Id[];
}

export interface SubstituteMark extends PastResult {
  kind: "replaced" | "done";
}

export interface SubstituteRow {
  exercise: Exercise;
  /** null — offered by history or by the muscle group, not by the reference. */
  relation: Relation | null;
  note: string | null;
  mark: SubstituteMark | null;
}

export interface SubstituteSections {
  /** «Ваша замена». */
  mine: SubstituteRow | null;
  /** «Похожие»: the reference, then progression neighbours, then past replacements. */
  similar: SubstituteRow[];
  /** «Ещё на <группу>»: the rest of the muscle group, done ones first. */
  more: SubstituteRow[];
}

export function substituteSections(input: SubstituteInput): SubstituteSections {
  const { target, last, replaced } = input;
  const byId = new Map(input.exercises.map((e) => [e.id, e]));
  const excluded = new Set(input.excludeIds ?? []);
  const used = new Set<Id>();

  // Each exercise once, the first place wins.
  const take = (id: Id | null | undefined): Exercise | null => {
    if (!id || id === target.id || excluded.has(id) || used.has(id)) return null;
    const e = byId.get(id);
    if (!e || e.archived_at) return null;
    used.add(id);
    return e;
  };
  const doneMark = (id: Id): SubstituteMark | null => {
    const r = last.get(id);
    return r ? { kind: "done", ...r } : null;
  };
  const mark = (id: Id): SubstituteMark | null => {
    const r = replaced.find((p) => p.exerciseId === id);
    return r ? { kind: "replaced", at: r.at, sets: r.sets } : doneMark(id);
  };
  const fromCatalog = new Map(input.catalog.map((c) => [c.id, c]));

  const mineExercise = take(target.substitute_id);
  const mineRef = mineExercise && fromCatalog.get(mineExercise.id);
  const mine = mineExercise && {
    exercise: mineExercise,
    relation: mineRef?.relation ?? null,
    note: mineRef?.note ?? null,
    mark: doneMark(mineExercise.id),
  };

  const similar: SubstituteRow[] = [];
  for (const c of input.catalog) {
    const e = take(c.id);
    if (e) similar.push({ exercise: e, relation: c.relation, note: c.note, mark: mark(e.id) });
  }
  if (input.chain) {
    const members = input.chain.members;
    const at = members.findIndex((m) => m.id === target.id);
    const note = `прогрессия «${input.chain.name}»`;
    for (const [i, relation] of [[at - 1, "easier"], [at + 1, "harder"]] as const) {
      const e = at >= 0 ? take(members[i]?.id) : null;
      if (e) similar.push({ exercise: e, relation, note, mark: mark(e.id) });
    }
  }
  for (const r of replaced) {
    const e = take(r.exerciseId);
    if (e) similar.push({ exercise: e, relation: null, note: null, mark: mark(e.id) });
  }

  const rest = input.exercises.filter((e) => e.muscle_group === target.muscle_group && take(e.id));
  rest.sort((a, b) => {
    const la = last.get(a.id)?.at, lb = last.get(b.id)?.at;
    if (la && lb) return lb.localeCompare(la);
    if (la || lb) return la ? -1 : 1;
    return compareRu(a.name, b.name);
  });
  const more = rest.map((e) => ({ exercise: e, relation: null, note: null, mark: mark(e.id) }));

  return { mine, similar, more };
}

/** «То же движение · гантели, по одной руке», or null when the row is not from the reference. */
export function relationText(row: Pick<SubstituteRow, "relation" | "note">): string | null {
  if (!row.relation) return null;
  return row.note ? `${RELATION_LABELS[row.relation]} · ${row.note}` : RELATION_LABELS[row.relation];
}

/** «Меняли 2 окт · 3 × 12 × 25 кг», «Делали 19 окт · 3 × 10 × 40 кг». */
export function markText(row: Pick<SubstituteRow, "exercise" | "mark">): string | null {
  const m = row.mark;
  if (!m) return null;
  return `${m.kind === "replaced" ? "Меняли" : "Делали"} ${formatDayMonth(m.at)} · ${formatSetsSummary(row.exercise.log_type, m.sets)}`;
}

/** «В прошлый раз: 3 × 12 × 8 кг» — under «Ваша замена». */
export function lastTimeText(row: Pick<SubstituteRow, "exercise" | "mark">): string | null {
  return row.mark ? `В прошлый раз: ${formatSetsSummary(row.exercise.log_type, row.mark.sets)}` : null;
}
