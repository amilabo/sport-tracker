import type { DBSchema, IDBPDatabase } from "idb";
import type {
  Exercise,
  Measurement,
  MeasurementType,
  Plan,
  PlanExercise,
  PlanSet,
  Progression,
  Settings,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/domain/types";

export const DB_NAME = "sport-tracker";
/**
 * IndexedDB structure version (stores and indexes). Keep it at 1: an older app version cannot open
 * a database of a newer version at all, so raising it would break rolling the site back.
 * New data goes into optional fields of existing stores instead (stage 34+).
 */
export const DB_VERSION = 1;
/**
 * Data format version, written to settings and to backup files.
 * 2 — optional rest fields on plans, plan exercises and workouts (stage 34); files of version 1 read as is.
 */
export const SCHEMA_VERSION = 2;

// Booleans and nulls are not valid IndexedDB keys, so is_demo / archived_at are filtered in memory.
export interface TrackerDB extends DBSchema {
  exercises: { key: string; value: Exercise; indexes: { progression_id: string } };
  progressions: { key: string; value: Progression };
  plans: { key: string; value: Plan };
  plan_exercises: { key: string; value: PlanExercise; indexes: { plan_id: string; exercise_id: string } };
  plan_sets: { key: string; value: PlanSet; indexes: { plan_exercise_id: string } };
  workouts: { key: string; value: Workout; indexes: { started_at: string; status: string; plan_id: string } };
  workout_exercises: { key: string; value: WorkoutExercise; indexes: { workout_id: string; exercise_id: string } };
  workout_sets: { key: string; value: WorkoutSet; indexes: { workout_exercise_id: string } };
  measurement_types: { key: string; value: MeasurementType };
  measurements: { key: string; value: Measurement; indexes: { date: string; measurement_type_id: string } };
  settings: { key: string; value: Settings };
}

export type TrackerDatabase = IDBPDatabase<TrackerDB>;

export function upgradeSchema(db: TrackerDatabase, oldVersion: number) {
  if (oldVersion < 1) {
    const exercises = db.createObjectStore("exercises", { keyPath: "id" });
    exercises.createIndex("progression_id", "progression_id");

    db.createObjectStore("progressions", { keyPath: "id" });
    db.createObjectStore("plans", { keyPath: "id" });

    const planExercises = db.createObjectStore("plan_exercises", { keyPath: "id" });
    planExercises.createIndex("plan_id", "plan_id");
    planExercises.createIndex("exercise_id", "exercise_id");

    const planSets = db.createObjectStore("plan_sets", { keyPath: "id" });
    planSets.createIndex("plan_exercise_id", "plan_exercise_id");

    const workouts = db.createObjectStore("workouts", { keyPath: "id" });
    workouts.createIndex("started_at", "started_at");
    workouts.createIndex("status", "status");
    workouts.createIndex("plan_id", "plan_id");

    const workoutExercises = db.createObjectStore("workout_exercises", { keyPath: "id" });
    workoutExercises.createIndex("workout_id", "workout_id");
    workoutExercises.createIndex("exercise_id", "exercise_id");

    const workoutSets = db.createObjectStore("workout_sets", { keyPath: "id" });
    workoutSets.createIndex("workout_exercise_id", "workout_exercise_id");

    db.createObjectStore("measurement_types", { keyPath: "id" });

    const measurements = db.createObjectStore("measurements", { keyPath: "id" });
    measurements.createIndex("date", "date");
    measurements.createIndex("measurement_type_id", "measurement_type_id");

    db.createObjectStore("settings", { keyPath: "id" });
  }
}
