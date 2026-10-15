import { formatNumber } from "./format";
import { formatCardioDuration, formatClock } from "./sets";
import type { Exercise, Id, LogType, WorkoutExercise, WorkoutSet } from "./types";
import type { SetField } from "./workout";

export interface PlanSetUpdate {
  planSetId: Id;
  field: SetField;
  value: number | null;
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

/**
 * Differences between what was done and the plan (PRD §3.5). Only done sets that came from the plan count;
 * replaced and skipped exercises are left out. Consecutive sets with the same change form one line.
 */
export function planChanges(items: DiffItem[]): PlanChange[] {
  const changes: PlanChange[] = [];
  for (const item of items) {
    if (item.replaced || item.we.skipped) continue;
    const logType = item.exercise.log_type;
    const planSets = item.sets.filter((s) => s.plan_set_id);
    const fields: SetField[] = ["weight", "reps", "duration_sec", "speed_kmh"];

    for (const field of fields) {
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
        const differs = s.done_at !== null && to !== null && to !== from;
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
