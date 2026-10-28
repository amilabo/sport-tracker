import { newEntity } from "./entity";
import type { Exercise, Id, Measurement, MeasurementType, Plan, PlanExercise, PlanSet, SetValues, Workout, WorkoutExercise, WorkoutSet } from "./types";

// Demo mode (PRD §3.12): ~12 workouts over 4 weeks with growing weights, 4 measurements, wellbeing ratings.
// Every record is is_demo = true, so «Удалить демо-данные» removes exactly them.

export interface DemoPlan {
  plan: Plan;
  items: { planExercise: PlanExercise; exercise: Exercise; sets: PlanSet[] }[];
}

/**
 * One replacement in history, so «Заменить на сегодня» shows «Меняли …» in demo mode (stage 28):
 * a busy cable row replaced by `to` once, two weeks before the last one.
 */
export interface DemoSwap {
  from: Id;
  to: Exercise;
  weight: number;
}

export interface DemoRecords {
  workouts: Workout[];
  workout_exercises: WorkoutExercise[];
  workout_sets: WorkoutSet[];
  measurements: Measurement[];
}

const WEEKS = 4;
const DAYS = [0, 2, 4]; // Mon, Wed, Fri of each week
/** Deterministic "random" in 0..1 so the demo looks the same every time. */
const noise = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Week 0 is lighter; the plan weight is reached in the last week (rounded to 2.5 kg, small weights to 0.5). */
function weightFor(plan: number | null, week: number): number | null {
  if (plan === null || plan <= 0) return plan;
  const w = plan * (0.85 + (0.15 * week) / (WEEKS - 1));
  const step = plan >= 10 ? 2.5 : 0.5;
  return Math.max(step, Math.round(w / step) * step);
}

export function buildDemo(plans: DemoPlan[], types: MeasurementType[], now: Date = new Date(), swap?: DemoSwap): DemoRecords {
  const out: DemoRecords = { workouts: [], workout_exercises: [], workout_sets: [], measurements: [] };
  if (!plans.length) return out;
  const demo = { is_demo: true };
  // Monday four weeks ago, local time.
  const start = new Date(now);
  start.setHours(9, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * WEEKS);

  let n = 0;
  let swapped = false;
  for (let week = 0; week < WEEKS; week++) {
    for (const day of DAYS) {
      const startedAt = new Date(start);
      startedAt.setDate(start.getDate() + week * 7 + day);
      startedAt.setMinutes(Math.round(noise(n) * 50));
      if (startedAt >= now) continue;
      const finishedAt = new Date(startedAt.getTime() + (55 + Math.round(noise(n + 7) * 25)) * 60_000);
      const { plan, items } = plans[n % plans.length];
      const at = finishedAt.toISOString();
      const workout: Workout = newEntity(
        {
          plan_id: plan.id,
          started_at: startedAt.toISOString(),
          finished_at: at,
          status: "finished" as const,
          wellbeing_before: 2 + Math.round(noise(n + 1) * 3),
          mood_before: 2 + Math.round(noise(n + 2) * 2),
          energy_after: 3 + Math.round(noise(n + 3) * 2),
          mood_after: 3 + Math.round(noise(n + 4) * 2),
          note: null,
          plan_update_prompted: true,
        },
        { ...demo, at },
      );
      out.workouts.push(workout);
      let doneIndex = 0;
      items.forEach((item, position) => {
        const swapHere = !!swap && !swapped && week === WEEKS - 2 && item.exercise.id === swap.from;
        if (swapHere) swapped = true;
        const we: WorkoutExercise = newEntity(
          {
            workout_id: workout.id,
            exercise_id: swapHere ? swap.to.id : item.exercise.id,
            replaced_exercise_id: swapHere ? swap.from : null,
            plan_exercise_id: item.planExercise.id,
            position,
            skipped: false,
            note: null,
          },
          { ...demo, at },
        );
        out.workout_exercises.push(we);
        item.sets.forEach((ps, setPos) => {
          // Now and then the last set of an exercise is left undone.
          const skipped = setPos === item.sets.length - 1 && noise(n * 31 + position) > 0.85;
          const values: SetValues = {
            weight: swapHere ? swap.weight : weightFor(ps.weight, week),
            reps: ps.reps,
            duration_sec: ps.duration_sec,
            speed_kmh: ps.speed_kmh,
          };
          out.workout_sets.push(
            newEntity(
              {
                workout_exercise_id: we.id,
                position: setPos,
                ...values,
                done_at: skipped ? null : new Date(startedAt.getTime() + (3 + doneIndex++ * 2) * 60_000).toISOString(),
                // A replacement has no plan targets (see replacedExercise).
                plan_set_id: swapHere ? null : ps.id,
                target_weight: swapHere ? null : ps.weight,
                target_reps: swapHere ? null : ps.reps,
                target_duration_sec: swapHere ? null : ps.duration_sec,
                target_speed_kmh: swapHere ? null : ps.speed_kmh,
              },
              { ...demo, at },
            ),
          );
        });
      });
      n++;
    }
  }

  // Four weekly measurements, slowly changing.
  const series: Record<string, number[]> = {
    weight: [70.2, 69.9, 69.5, 69.4],
    fat_kg: [21.0, 20.7, 20.4, 20.2],
    muscle_kg: [26.8, 26.9, 27.1, 27.2],
    waist: [76, 75.5, 75, 74.5],
    hips: [101, 100.5, 100.5, 100],
  };
  for (let week = 0; week < WEEKS; week++) {
    const d = new Date(start);
    d.setDate(start.getDate() + week * 7);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const [key, values] of Object.entries(series)) {
      const type = types.find((t) => t.key === key);
      if (type) out.measurements.push(newEntity({ date, measurement_type_id: type.id as Id, value: values[week] }, { ...demo, at: d.toISOString() }));
    }
  }
  return out;
}
