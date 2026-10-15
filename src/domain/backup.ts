import { DomainError, STORE_NAMES, type IsoDateTime, type StoreName, type StoreRecords } from "./types";

// Backup file (PRD §3.11): all stores as arrays of records, field names as in the database.

export const BACKUP_APP = "sport-tracker";
/** Bumped only when an old app could misread a new file. */
export const BACKUP_FORMAT = 1;

export type BackupData = { [K in StoreName]?: StoreRecords[K][] };

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  schema_version: number;
  exported_at: IsoDateTime;
  data: BackupData;
}

export interface BackupCounts {
  workouts: number;
  plans: number;
  exercises: number;
  measurements: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reads and checks a backup file. Throws DomainError with a message for the user. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new DomainError("Это не файл копии: не получается прочитать содержимое");
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP || !isObject(raw.data)) {
    throw new DomainError("Это не файл копии «Спорт трекера»");
  }
  if (typeof raw.format !== "number" || raw.format > BACKUP_FORMAT) {
    throw new DomainError("Файл сделан в более новой версии приложения. Обновите приложение и попробуйте снова");
  }

  const data: BackupData = {};
  for (const store of STORE_NAMES) {
    const rows = raw.data[store];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new DomainError(`Файл повреждён: раздел «${store}» не список`);
    rows.forEach((row, i) => {
      if (!isObject(row) || typeof row.id !== "string" || !row.id || typeof row.updated_at !== "string") {
        throw new DomainError(`Файл повреждён: запись ${i + 1} в разделе «${store}»`);
      }
    });
    (data as Record<string, unknown[]>)[store] = rows;
  }

  return {
    app: BACKUP_APP,
    format: raw.format,
    schema_version: typeof raw.schema_version === "number" ? raw.schema_version : 1,
    exported_at: typeof raw.exported_at === "string" ? raw.exported_at : "",
    data,
  };
}

/** What the user sees before importing: «в файле: 2 тренировки…». Demo records are not counted. */
export function backupCounts(file: BackupFile): BackupCounts {
  const real = (store: StoreName) => (file.data[store] ?? []).filter((r) => !r.is_demo).length;
  return { workouts: real("workouts"), plans: real("plans"), exercises: real("exercises"), measurements: real("measurements") };
}

/** References that must point to an existing record after import: [store, field, target store]. */
export const BACKUP_REFS: [StoreName, string, StoreName][] = [
  ["plan_exercises", "plan_id", "plans"],
  ["plan_exercises", "exercise_id", "exercises"],
  ["plan_sets", "plan_exercise_id", "plan_exercises"],
  ["workouts", "plan_id", "plans"],
  ["workout_exercises", "workout_id", "workouts"],
  ["workout_exercises", "exercise_id", "exercises"],
  ["workout_exercises", "replaced_exercise_id", "exercises"],
  ["workout_sets", "workout_exercise_id", "workout_exercises"],
  ["measurements", "measurement_type_id", "measurement_types"],
  ["exercises", "progression_id", "progressions"],
];
