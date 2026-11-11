import { progressSuggestion, type LineValues, type OptionKind, type PastLine, type ProgressReason, type ProgressSuggestion } from "./analytics/progression-options";
import { perSide, repCeiling, sideFactor, stepOf } from "./analytics/progress-settings";
import { formatNumber, plural } from "./format";
import { formatCardioDuration, formatClock } from "./sets";
import type { Exercise, Id, IsoDateTime, LogType, ProgressPrefer, WorkoutExercise, WorkoutSet } from "./types";
import type { SetField } from "./workout";

export interface PlanSetUpdate {
  planSetId: Id;
  field: SetField;
  value: number | null;
}

/** One way to progress a plan line (stage 52, mockup Р1): «+1 повтор · 3 × 14 → 3 × 15». */
export interface ProgressChoice {
  kind: OptionKind;
  label: string;
  detail: string;
  updates: PlanSetUpdate[];
  /** «+1 подход»: a copy of the last plan set. */
  addSet?: { planExerciseId: Id };
}

export interface PlanProgress {
  exerciseId: Id;
  reason: ProgressReason;
  /** First — the one chosen by default. */
  choices: ProgressChoice[];
  /** What can be set right under the choices: «шаг веса 5 кг · изменить», «потолок 15 · изменить». */
  setting: { kind: "step" | "ceiling"; text: string; value: number } | null;
}

/** One line in «Обновить веса в плане?»: a field change of consecutive sets of one exercise. */
export interface PlanChange {
  key: string;
  exerciseName: string;
  /** "подход 2", "подходы 2–3", "все 4 подхода" */
  where: string;
  from: string;
  to: string;
  updates: PlanSetUpdate[];
  /** «Отдых между подходами» of a plan exercise (stage 37); no set updates then. */
  rest?: { planExerciseId: Id; sec: number };
  /** «Как прибавить» (stage 52): the line offers several ways; `updates` are the first one's until one is chosen. */
  progress?: PlanProgress;
  /** Set by the choice: one more plan set (copy of the last). */
  addSet?: { planExerciseId: Id };
  /** Set by the choice: what to offer first next time for this exercise. */
  prefer?: { exerciseId: Id; value: ProgressPrefer };
}

export interface DiffItem {
  we: WorkoutExercise;
  exercise: Exercise;
  replaced: Exercise | null;
  sets: WorkoutSet[];
}

const TARGET: Record<SetField, keyof WorkoutSet> = {
  weight: "target_weight",
  reps: "target_reps",
  duration_sec: "target_duration_sec",
  speed_kmh: "target_speed_kmh",
};

function valueText(logType: LogType, field: SetField, v: number | null): string {
  if (v === null) return "—";
  switch (field) {
    case "weight":
      return `${logType === "bodyweight_plus" && v > 0 ? "+" : ""}${formatNumber(v, 2).replace("-", "−")} кг`;
    case "reps":
      return `${v} раз`;
    case "speed_kmh":
      return `${formatNumber(v)} км/ч`;
    case "duration_sec":
      return logType === "cardio" ? formatCardioDuration(v) : formatClock(v);
  }
}

function whereText(positions: number[], planSetCount: number): string {
  if (positions.length === planSetCount && planSetCount > 1) {
    return `все ${planSetCount} ${planSetCount < 5 ? "подхода" : "подходов"}`;
  }
  if (positions.length === 1) return `подход ${positions[0]}`;
  const consecutive = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
  return consecutive ? `подходы ${positions[0]}–${positions.at(-1)}` : `подходы ${positions.join(", ")}`;
}

export interface PlanChangesOptions {
  /**
   * The first workout after a break (stage 44): weights were lowered on purpose, so a lower weight is not
   * offered to the plan — only a higher one.
   */
  comeback?: boolean;
  /**
   * «Как прибавить» (stages 41, 52): the same plan lines (by `plan_exercise_id`) in earlier completed workouts by this
   * plan, newest first, and when this one started. Absent — no progress lines.
   */
  past?: Map<Id, PastLine[]>;
  startedAt?: IsoDateTime;
  /**
   * Circuits «По времени» of the workout (stage 39): their time is the circuit's, and reps are written in the gym, not
   * planned — neither is offered to the plan. Weights are.
   */
  timedCircuits?: ReadonlySet<Id>;
}

/**
 * Differences between what was done and the plan (PRD §3.5). Only done sets that came from the plan count;
 * replaced and skipped exercises are left out. Consecutive sets with the same change form one line.
 */
export function planChanges(items: DiffItem[], options: PlanChangesOptions = {}): PlanChange[] {
  const changes: PlanChange[] = [];
  for (const item of items) {
    if (item.replaced || item.we.skipped) continue;
    const logType = item.exercise.log_type;
    const planSets = item.sets.filter((s) => s.plan_set_id);
    const fields: SetField[] = ["weight", "reps", "duration_sec", "speed_kmh"];

    // «Как прибавить» replaces the item's weight and reps lines: one line for all sets, the ways to choose from,
    // the reason in the grey line. Done heavier or more already — that is in the choices.
    const timed = !!item.we.circuit_id && !!options.timedCircuits?.has(item.we.circuit_id);
    const past = options.past && options.startedAt && item.we.plan_exercise_id && !timed ? options.past.get(item.we.plan_exercise_id) : undefined;
    const suggestion = past ? progressSuggestion(item, options.startedAt!, past) : null;
    if (suggestion) changes.push(progressChange(item, suggestion, planSets));

    for (const field of fields) {
      if (suggestion && (field === "weight" || field === "reps")) continue;
      if (timed && (field === "reps" || field === "duration_sec")) continue;
      let group: { from: number | null; to: number | null; positions: number[]; updates: PlanSetUpdate[] } | null = null;
      const flush = () => {
        if (!group) return;
        changes.push({
          key: `${item.we.id}:${field}:${group.positions.join(",")}`,
          exerciseName: item.exercise.name,
          where: whereText(group.positions, planSets.length),
          from: valueText(logType, field, group.from),
          to: valueText(logType, field, group.to),
          updates: group.updates,
        });
        group = null;
      };

      planSets.forEach((s, idx) => {
        const from = s[TARGET[field]] as number | null;
        const to = s[field];
        const position = idx + 1;
        const lowered = options.comeback && field === "weight" && from !== null && to !== null && to < from;
        const differs = s.done_at !== null && to !== null && to !== from && !lowered;
        if (!differs) return flush();
        const g = group as { from: number | null; to: number | null; positions: number[]; updates: PlanSetUpdate[] } | null;
        if (g && g.from === from && g.to === to && g.positions.at(-1) === position - 1) {
          g.positions.push(position);
          g.updates.push({ planSetId: s.plan_set_id!, field, value: to });
        } else {
          flush();
          group = { from, to, positions: [position], updates: [{ planSetId: s.plan_set_id!, field, value: to }] };
        }
      });
      flush();
    }
  }
  return changes;
}

const kg = (n: number) => `${formatNumber(n, 2)} кг`;
const times = (n: number) => `${n} ${plural(n, ["разу", "раза", "раз"])}`;

/** «3 × 14 × 40 кг», «3 × 20». */
function lineText(l: LineValues): string {
  return `${l.sets} × ${l.reps}${l.weight !== null ? ` × ${kg(l.weight)}` : ""}`;
}

/** The grey line: why it is offered. */
function progressWhere(s: ProgressSuggestion, side: boolean): string {
  const per = (reps: number) => (side ? `${formatNumber(reps / 2)} на сторону` : times(reps));
  switch (s.reason) {
    case "double":
      return `${side ? "на каждую сторону" : "все подходы"} · 2 тренировки подряд по ${per(s.from.reps)}`;
    case "ceiling":
      return `дошли до потолка: ${per(s.from.reps)}, 2 тренировки подряд`;
    case "stall": {
      const d = new Date(s.since);
      const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      return `без изменений с ${date} · ${s.runs} ${plural(s.runs, ["тренировка", "тренировки", "тренировок"])}, всё по плану`;
    }
  }
}

function progressChange(item: DiffItem, s: ProgressSuggestion, planSets: WorkoutSet[]): PlanChange {
  const ex = item.exercise;
  const side = perSide(ex);
  const all = (field: SetField, value: number): PlanSetUpdate[] => planSets.map((p) => ({ planSetId: p.plan_set_id!, field, value }));
  const from = s.from;
  const choices: ProgressChoice[] = s.options.map(({ kind, to }) => {
    const dw = to.weight !== null && from.weight !== null ? Math.round((to.weight - from.weight) * 100) / 100 : 0;
    switch (kind) {
      case "reps": {
        const n = to.reps - from.reps;
        return {
          kind,
          label: side ? `+${formatNumber(n / 2)} на сторону` : `+${n} ${plural(n, ["повтор", "повтора", "повторов"])}`,
          detail: side ? `${from.reps} → ${to.reps} (по ${formatNumber(to.reps / 2)})` : `${from.sets} × ${from.reps} → ${to.sets} × ${to.reps}`,
          updates: all("reps", to.reps),
        };
      }
      case "weight":
        return { kind, label: `+${kg(dw)}`, detail: `${formatNumber(from.weight!, 2)} → ${kg(to.weight!)}`, updates: all("weight", to.weight!) };
      case "weight_reset":
        return {
          kind,
          label: `+${kg(dw)}, ${times(to.reps)}`,
          detail: `${formatNumber(from.weight!, 2)} → ${kg(to.weight!)} × ${to.reps}`,
          updates: [...all("weight", to.weight!), ...all("reps", to.reps)],
        };
      case "set":
        return {
          kind,
          label: "+1 подход",
          detail: `${from.sets} → ${to.sets} × ${to.reps}`,
          updates: [],
          addSet: { planExerciseId: item.we.plan_exercise_id! },
        };
    }
  });
  const hasWeight = choices.some((c) => c.kind === "weight" || c.kind === "weight_reset");
  const ceiling = repCeiling(ex) / sideFactor(ex);
  const setting: PlanProgress["setting"] =
    s.reason === "ceiling" || !hasWeight
      ? { kind: "ceiling", text: `потолок ${ceiling}${side ? " на сторону" : ""}`, value: ceiling }
      : { kind: "step", text: `шаг веса ${kg(stepOf(ex))}`, value: stepOf(ex) };
  return choose(
    {
      key: `${item.we.id}:progress`,
      exerciseName: ex.name,
      where: progressWhere(s, side),
      from: lineText(from),
      to: "",
      updates: [],
      progress: { exerciseId: ex.id, reason: s.reason, choices, setting },
    },
    0,
  );
}

/** The line with the chosen way applied (stage 52): what is written to the plan, and the choice remembered. */
export function choose(change: PlanChange, index: number): PlanChange {
  const p = change.progress;
  const c = p?.choices[index];
  if (!p || !c) return change;
  return {
    ...change,
    to: c.detail,
    updates: c.updates,
    addSet: c.addSet,
    prefer: { exerciseId: p.exerciseId, value: c.kind === "weight" || c.kind === "weight_reset" ? "weight" : "reps" },
  };
}
