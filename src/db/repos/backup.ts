import { BACKUP_APP, BACKUP_FORMAT, BACKUP_REFS, type BackupData, type BackupFile } from "@/domain/backup";
import { cleanName, searchKey } from "@/domain/text";
import { nowIso } from "@/domain/time";
import { DomainError, SETTINGS_ID, STORE_NAMES, type BaseEntity, type Exercise, type StoreName, type Workout, type WorkoutSet } from "@/domain/types";
import { lastActivity } from "@/domain/workout";
import { withTx } from "../client";
import { SCHEMA_VERSION } from "../schema";
import { buildSeedData } from "../seed";

/**
 * «Объединить» adds what is missing and keeps the newer version of a record present in both places.
 * «Заменить всё» deletes everything on the phone and writes the file as is.
 */
export type ImportMode = "merge" | "replace";

export interface ImportResult {
  added: number;
  updated: number;
  /** Records that were already on the phone in the same or a newer version. */
  kept: number;
  workoutsAdded: number;
  /** Exercises renamed because the phone already has another exercise with that name: "Жим (2)". */
  renamed: string[];
}

type Row = BaseEntity & Record<string, unknown>;
/** Store operations used here; the store name is dynamic, so the typed idb store is narrowed by hand. */
interface AnyStore {
  get(id: string): Promise<Row | undefined>;
  getAll(): Promise<Row[]>;
  put(value: Row): Promise<unknown>;
  clear(): Promise<void>;
  index(name: string): { getAll(key: string): Promise<Row[]> };
}

export const backupRepo = {
  /** Everything on the phone in one consistent snapshot. */
  async exportAll(): Promise<BackupFile> {
    return withTx(STORE_NAMES, "readonly", async (tx) => {
      const data: BackupData = {};
      for (const name of STORE_NAMES) {
        (data as Record<string, Row[]>)[name] = await (tx.objectStore(name) as unknown as AnyStore).getAll();
      }
      return { app: BACKUP_APP, format: BACKUP_FORMAT, schema_version: SCHEMA_VERSION, exported_at: nowIso(), data };
    });
  },

  /**
   * «Удалить все данные»: the app becomes as on first launch (starter catalog and plans).
   * Kept: theme and the dismissed install hint — they are settings of this phone, not records.
   */
  async wipe(): Promise<void> {
    await withTx(STORE_NAMES, "readwrite", async (tx) => {
      const store = (name: StoreName) => tx.objectStore(name) as unknown as AnyStore;
      const old = await store("settings").get(SETTINGS_ID);
      for (const name of STORE_NAMES) await store(name).clear();
      const seed = buildSeedData();
      const settings = {
        ...seed.settings,
        ...(old ? { theme_mode: old.theme_mode, color_theme: old.color_theme, install_hint_dismissed: old.install_hint_dismissed } : {}),
      };
      const rows: [StoreName, BaseEntity[]][] = [
        ["exercises", seed.exercises], ["plans", seed.plans], ["plan_exercises", seed.planExercises],
        ["plan_sets", seed.planSets], ["measurement_types", seed.measurementTypes], ["settings", [settings]],
      ];
      for (const [name, list] of rows) for (const row of list) await store(name).put(row as Row);
    });
  },

  /** All or nothing: on any error the phone keeps exactly what it had. */
  async import(file: BackupFile, mode: ImportMode): Promise<ImportResult> {
    return withTx(STORE_NAMES, "readwrite", async (tx) => {
      const store = (name: StoreName) => tx.objectStore(name) as unknown as AnyStore;
      const result: ImportResult = { added: 0, updated: 0, kept: 0, workoutsAdded: 0, renamed: [] };
      const written = new Map<StoreName, Set<string>>(STORE_NAMES.map((n) => [n, new Set()]));

      const phoneSettings = await store("settings").get(SETTINGS_ID);
      if (mode === "replace") for (const name of STORE_NAMES) await store(name).clear();

      // Exercise names are unique (case and ё do not matter): name key → id.
      const names = new Map<string, string>();
      for (const e of (await store("exercises").getAll()) as unknown as Exercise[]) names.set(searchKey(e.name), e.id);

      for (const name of STORE_NAMES) {
        // Merge keeps this phone's settings (theme, height, last backup date).
        if (name === "settings" && mode === "merge") continue;
        for (const original of (file.data[name] ?? []) as unknown as Row[]) {
          let row = original;
          const existing = mode === "merge" ? await store(name).get(row.id) : undefined;
          if (existing && existing.updated_at >= row.updated_at) {
            result.kept++;
            continue;
          }
          if (name === "exercises") {
            const taken = (n: string) => {
              const owner = names.get(searchKey(n));
              return owner !== undefined && owner !== row.id;
            };
            const base = cleanName(String(row.name));
            let next = base;
            for (let i = 2; taken(next); i++) next = `${base} (${i})`;
            if (next !== base) {
              row = { ...row, name: next };
              result.renamed.push(next);
            }
            names.set(searchKey(next), row.id);
          }
          await store(name).put(row);
          written.get(name)!.add(row.id);
          if (existing) result.updated++;
          else {
            result.added++;
            if (name === "workouts") result.workoutsAdded++;
          }
        }
      }

      // «Заменить всё» with a file without settings would re-run the first-launch seed: keep this phone's.
      if (!(await store("settings").get(SETTINGS_ID)) && phoneSettings) await store("settings").put(phoneSettings);

      // Every reference of a written record must lead somewhere, otherwise screens would break.
      for (const [name, field, target] of BACKUP_REFS) {
        for (const id of written.get(name)!) {
          const ref = (await store(name).get(id))?.[field];
          if (typeof ref === "string" && !(await store(target).get(ref))) {
            throw new DomainError("Файл неполный: в нём есть ссылки на записи, которых нет ни в файле, ни в телефоне. Ничего не изменено");
          }
        }
      }

      // Only one workout can be in progress: keep the latest, finish the others as if left until the next day.
      const active = ((await store("workouts").index("status").getAll("in_progress")) as unknown as Workout[]).sort((a, b) =>
        b.started_at.localeCompare(a.started_at),
      );
      for (const w of active.slice(1)) {
        const wes = await store("workout_exercises").index("workout_id").getAll(w.id);
        const sets: WorkoutSet[] = [];
        for (const we of wes) sets.push(...((await store("workout_sets").index("workout_exercise_id").getAll(we.id)) as unknown as WorkoutSet[]));
        await store("workouts").put({ ...w, status: "auto_finished", finished_at: lastActivity(w, sets), updated_at: nowIso() } as unknown as Row);
      }

      return result;
    });
  },
};
