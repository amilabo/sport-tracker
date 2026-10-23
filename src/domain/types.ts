// Entities from PRD §6 (v1.7). Field names are snake_case: they are also the backup file format.

export type Id = string;
/** ISO 8601 timestamp in UTC, e.g. "2026-10-15T09:24:00.000Z". */
export type IsoDateTime = string;
/** Local calendar date "YYYY-MM-DD". */
export type LocalDate = string;

export interface BaseEntity {
  id: Id;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  is_demo: boolean;
}

export const LOG_TYPES = ["weight_reps", "reps", "bodyweight_plus", "time", "cardio"] as const;
export type LogType = (typeof LOG_TYPES)[number];

export const MUSCLE_GROUPS = [
  "chest", "back", "legs", "glutes", "shoulders", "arms", "abs", "cardio", "full_body",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  "barbell", "dumbbells", "kettlebell", "dumbbells_kettlebell", "machine", "cable", "bodyweight", "band", "cardio_machine", "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export interface Exercise extends BaseEntity {
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  log_type: LogType;
  is_builtin: boolean;
  archived_at: IsoDateTime | null;
  progression_id: Id | null;
  progression_level: number | null;
  /** «Как делать» in the person's own words — own exercises only (stage 27); catalog ones ship theirs in the app. */
  description?: string | null;
}

export interface Progression extends BaseEntity {
  name: string;
}

export type PlanSource = "self" | "coach";

export interface Plan extends BaseEntity {
  name: string;
  source: PlanSource;
  archived_at: IsoDateTime | null;
}

export interface PlanExercise extends BaseEntity {
  plan_id: Id;
  exercise_id: Id;
  position: number;
  note: string | null;
}

/** Values of one set. Which fields are used depends on the exercise log type; the rest stay null. */
export interface SetValues {
  weight: number | null;
  reps: number | null;
  duration_sec: number | null;
  speed_kmh: number | null;
}

export interface PlanSet extends BaseEntity, SetValues {
  plan_exercise_id: Id;
  position: number;
}

export type WorkoutStatus = "in_progress" | "finished" | "auto_finished";

export interface Workout extends BaseEntity {
  plan_id: Id | null;
  started_at: IsoDateTime;
  finished_at: IsoDateTime | null;
  status: WorkoutStatus;
  wellbeing_before: number | null;
  mood_before: number | null;
  energy_after: number | null;
  mood_after: number | null;
  note: string | null;
  plan_update_prompted: boolean;
}

export interface WorkoutExercise extends BaseEntity {
  workout_id: Id;
  exercise_id: Id;
  replaced_exercise_id: Id | null;
  plan_exercise_id: Id | null;
  position: number;
  skipped: boolean;
  note: string | null;
}

export interface WorkoutSet extends BaseEntity, SetValues {
  workout_exercise_id: Id;
  position: number;
  /** null — the set was not done. */
  done_at: IsoDateTime | null;
  plan_set_id: Id | null;
  // Snapshot of the plan target at workout start.
  target_weight: number | null;
  target_reps: number | null;
  target_duration_sec: number | null;
  target_speed_kmh: number | null;
}

export type MeasurementComputed = "bmi" | "percent_of_weight";

export interface MeasurementType extends BaseEntity {
  name: string;
  unit: string;
  /** Stable key of a built-in type; null for user types. */
  key: string | null;
  is_builtin: boolean;
  archived_at: IsoDateTime | null;
  computed: MeasurementComputed | null;
  /** For percent_of_weight: the kg type the percentage is derived from. */
  base_type_id: Id | null;
  position: number;
}

export interface Measurement extends BaseEntity {
  date: LocalDate;
  measurement_type_id: Id;
  value: number;
}

export type ThemeMode = "light" | "dark" | "system";

export interface Settings extends BaseEntity {
  last_export_at: IsoDateTime | null;
  install_hint_dismissed: boolean;
  schema_version: number;
  height_cm: number | null;
  theme_mode: ThemeMode;
  color_theme: string;
  /** Accent color id (lib/theme ACCENTS); absent in records made before stage 21 — means the default. */
  accent?: string;
  /** The «Тело» comparison switch (domain/body-compare); absent in records made before stage 24 — means «Прошлый». */
  body_period?: string;
  /** The two dates of «Даты»; kept while another period is chosen, so switching back restores them. */
  body_custom?: { a: LocalDate | null; b: LocalDate | null } | null;
}

export const SETTINGS_ID = "app";

export interface StoreRecords {
  exercises: Exercise;
  progressions: Progression;
  plans: Plan;
  plan_exercises: PlanExercise;
  plan_sets: PlanSet;
  workouts: Workout;
  workout_exercises: WorkoutExercise;
  workout_sets: WorkoutSet;
  measurement_types: MeasurementType;
  measurements: Measurement;
  settings: Settings;
}

export type StoreName = keyof StoreRecords;

export const STORE_NAMES: StoreName[] = [
  "exercises", "progressions", "plans", "plan_exercises", "plan_sets",
  "workouts", "workout_exercises", "workout_sets",
  "measurement_types", "measurements", "settings",
];

/** A user-facing error: the message is shown in the UI as is. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
