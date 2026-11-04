import { formatDayMonth, formatTime, plural } from "./format";
import { toLocalDate } from "./time";
import type { IsoDateTime, Workout } from "./types";

// «Копия данных» in the APK (mockups КД1–КД2): the automatic copy on this phone and the copy sent away, in one screen.

export type BackupStatusKind = "saved" | "waiting" | "broken" | "manual";

export interface BackupStatus {
  kind: BackupStatusKind;
  title: string;
  text: string;
}

export interface BackupStatusInput {
  pref: "on" | "off" | null;
  /** undefined — not asked yet. */
  folder: { ok: boolean } | null | undefined;
  /** The last automatic copy into the folder. */
  autoLastAt: IsoDateTime | null;
  /** The last copy sent through «Отправить копию» (settings.last_export_at). */
  exportAt: IsoDateTime | null;
  /** Workouts recorded or changed since the last sent copy. */
  unsent: number;
  now?: Date;
}

const WORKOUT_FORMS: [string, string, string] = ["тренировка", "тренировки", "тренировок"];

function isToday(at: string, now: Date): boolean {
  return toLocalDate(new Date(at)) === toLocalDate(now);
}

/** "сегодня, 18:42" / "1 ноя, 20:15". */
function dayAndTime(at: string, now: Date): string {
  return `${isToday(at, now) ? "сегодня" : formatDayMonth(at)}, ${formatTime(at)}`;
}

/** "сегодня" / "6 окт". */
function day(at: string, now: Date): string {
  return isToday(at, now) ? "сегодня" : formatDayMonth(at);
}

/** Own finished workouts changed after the last sent copy (all of them, if none was sent). */
export function unsentWorkouts(
  exportAt: IsoDateTime | null,
  workouts: Pick<Workout, "status" | "updated_at" | "is_demo">[],
): number {
  return workouts.filter((w) => !w.is_demo && w.status !== "in_progress" && (!exportAt || w.updated_at > exportAt)).length;
}

/** The summary on top of «Копия данных»: are the records kept anywhere but in the app itself. */
export function backupStatus({ pref, folder, autoLastAt, exportAt, unsent, now = new Date() }: BackupStatusInput): BackupStatus {
  if (pref === "on" && folder && !folder.ok) {
    return {
      kind: "broken",
      title: "Автокопия не сохраняется",
      text: `Нет доступа к папке.${autoLastAt ? ` Последняя автокопия — ${day(autoLastAt, now)}.` : ""}`,
    };
  }
  if (pref === "on" && folder) {
    if (!autoLastAt) return { kind: "waiting", title: "Автокопия включена", text: "Первая копия — после первой тренировки или замера." };
    return {
      kind: "saved",
      title: "Данные сохранены",
      text: `Автокопия: ${dayAndTime(autoLastAt, now)}. Вне телефона — ${exportAt ? day(exportAt, now) : "ещё не отправляли"}.`,
    };
  }
  const left = unsent > 0 ? `${unsent} ${plural(unsent, WORKOUT_FORMS)}` : "";
  if (!exportAt) {
    return {
      kind: "manual",
      title: "Копия — только вручную",
      text: left ? `Копию ещё не отправляли: ${left} — только в этом телефоне.` : "Копию ещё не отправляли.",
    };
  }
  return {
    kind: "manual",
    title: "Копия — только вручную",
    text: `Последняя: ${dayAndTime(exportAt, now)}, отправлена.${left ? ` С тех пор — ${left} без копии.` : ""}`,
  };
}

/** The «Копия данных» row in «Ещё» (КД1): how the copy is kept, and the day of the freshest copy of any kind. */
export function backupRow(input: Omit<BackupStatusInput, "unsent">): { sub: string; hint: string; danger: boolean } {
  const now = input.now ?? new Date();
  const status = backupStatus({ ...input, unsent: 0, now });
  const latest = [input.autoLastAt, input.exportAt].filter((a): a is string => !!a).sort().pop();
  const sub = status.kind === "broken" ? "Автокопия не сохраняется" : status.kind === "manual" ? "Только вручную" : "Автокопия включена";
  return { sub, hint: latest ? day(latest, now) : "не сохраняли", danger: status.kind === "broken" };
}
