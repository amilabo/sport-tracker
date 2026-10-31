import { seedId } from "@/domain/ids";
import type { Exercise, MuscleGroup } from "@/domain/types";

// Secondary muscle groups of the catalog (stage 42б, table docs/exercise-muscles.md): the muscles that move the joint
// together with the main one; each gets half a set in «Нагрузка недели». Muscles that only hold the position
// (the lower back in a squat, the abs in a plank) are not counted. Like «Как делать», shipped with the app and looked
// up by the stable seed id: not stored on the phone, not in the backup; a corrected table reaches everyone with an update.
export const CATALOG_SECONDARY: Record<string, MuscleGroup[]> = {
  // Грудь
  push_ups: ["arms", "shoulders"],
  knee_push_ups: ["arms", "shoulders"],
  bench_press: ["arms", "shoulders"],
  dumbbell_bench_press: ["arms", "shoulders"],
  machine_chest_press: ["arms", "shoulders"],
  incline_bench_press: ["shoulders", "arms"],
  incline_dumbbell_press: ["shoulders", "arms"],
  pec_deck: ["shoulders"],
  dumbbell_fly: ["shoulders"],
  cable_crossover: ["shoulders"],
  dumbbell_pullover: ["back", "arms"],
  // Спина
  pull_ups: ["arms"],
  band_pull_ups: ["arms"],
  assisted_pull_ups: ["arms"],
  lat_pulldown: ["arms"],
  close_grip_pulldown: ["arms"],
  seated_cable_row: ["arms", "shoulders"],
  dumbbell_row: ["arms", "shoulders"],
  barbell_row: ["arms", "shoulders"],
  t_bar_row: ["arms", "shoulders"],
  hammer_row: ["arms", "shoulders"],
  cable_pullover: ["arms"],
  superman_scapula: ["glutes"],
  back_extension: ["glutes", "legs"],
  deadlift: ["glutes", "legs"],
  dumbbell_shrug: [],
  // Ноги
  barbell_squat: ["glutes"],
  smith_squat: ["glutes"],
  hack_squat: ["glutes"],
  goblet_squat: ["glutes"],
  leg_press: ["glutes"],
  dumbbell_lunges: ["glutes"],
  reverse_lunge: ["glutes"],
  smith_lunge: ["glutes"],
  bulgarian_split_squat: ["glutes"],
  step_up: ["glutes"],
  leg_extension: [],
  lying_leg_curl: [],
  seated_leg_curl: [],
  seated_hip_adduction: [],
  romanian_deadlift: ["glutes"],
  // Ягодицы
  hip_thrust: ["legs"],
  machine_hip_thrust: ["legs"],
  smith_hip_thrust: ["legs"],
  glute_bridge: ["legs"],
  single_leg_glute_bridge: ["legs"],
  froggy: [],
  cable_kickback: ["legs"],
  reverse_hyperextension: ["legs"],
  kettlebell_swing: ["legs"],
  single_leg_balance_hinge: ["legs"],
  plie_squat: ["legs"],
  seated_hip_abduction: [],
  cable_hip_abduction: [],
  // Плечи
  dumbbell_shoulder_press: ["arms"],
  barbell_overhead_press: ["arms"],
  machine_shoulder_press: ["arms"],
  arnold_press: ["arms"],
  seated_lateral_raise: [],
  standing_lateral_raise: [],
  cable_lateral_raise: [],
  machine_lateral_raise: [],
  upright_row: ["back", "arms"],
  dumbbell_front_raise: ["chest"],
  plate_front_raise: ["chest"],
  cable_front_raise: ["chest"],
  bent_over_reverse_fly: ["back"],
  incline_reverse_fly: ["back"],
  reverse_pec_deck: ["back"],
  cable_reverse_fly: ["back"],
  face_pull: ["back"],
  band_pull_apart: ["back"],
  // Руки
  dips: ["chest", "shoulders"],
  bench_dips: ["shoulders"],
  barbell_curl: [],
  dumbbell_curl: [],
  cable_curl: [],
  cable_curl_reverse: [],
  hammer_curl: [],
  preacher_curl: [],
  concentration_curl: [],
  french_press: [],
  cable_triceps_extension: [],
  overhead_triceps_extension: [],
  // Пресс, кардио, всё тело — без вторичных
  crunches: [],
  reverse_crunch: [],
  bicycle_crunch: [],
  cable_crunch: [],
  hanging_leg_raise: [],
  forearm_plank: [],
  side_plank: [],
  dead_bug: [],
  stomach_vacuum: [],
  treadmill_walk: [],
  treadmill_run: [],
  exercise_bike: [],
  elliptical: [],
  stair_stepper: [],
  jump_rope: [],
  rowing_machine: [],
  burpee: [],
  mountain_climber: [],
};

const BY_ID = new Map(Object.entries(CATALOG_SECONDARY).map(([key, g]) => [seedId(`exercise:${key}`), g]));

/** Groups without secondary ones: cardio and whole-body exercises are not in the weekly load. */
export const NO_SECONDARY: MuscleGroup[] = ["cardio", "full_body"];

/** At most two secondary groups (А8). */
export const SECONDARY_MAX = 2;

/**
 * The main group and the secondary ones: the catalog table for a built-in exercise, the person's choice
 * (`secondary_groups`) for their own one. The main group is never secondary; cardio and whole body have none.
 */
export function muscleGroupsOf(exercise: Pick<Exercise, "id" | "is_builtin" | "muscle_group" | "secondary_groups">): { main: MuscleGroup; secondary: MuscleGroup[] } {
  const main = exercise.muscle_group;
  if (NO_SECONDARY.includes(main)) return { main, secondary: [] };
  const list = (exercise.is_builtin ? BY_ID.get(exercise.id) : undefined) ?? exercise.secondary_groups ?? [];
  return { main, secondary: list.filter((g) => g !== main && !NO_SECONDARY.includes(g)).slice(0, SECONDARY_MAX) };
}

/** What the form stores: other than the main group, no cardio or whole body, no repeats, at most two. */
export function cleanSecondary(main: MuscleGroup, groups: readonly MuscleGroup[] | null | undefined): MuscleGroup[] {
  if (NO_SECONDARY.includes(main)) return [];
  return [...new Set(groups ?? [])].filter((g) => g !== main && !NO_SECONDARY.includes(g)).slice(0, SECONDARY_MAX);
}
