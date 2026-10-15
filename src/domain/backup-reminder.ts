import type { IsoDateTime, Workout } from "./types";

export const BACKUP_REMINDER_DAYS = 7;

/**
 * «Давно не сохраняли копию» (PRD §3.11): more than 7 days since the last copy (or since the first launch,
 * if there was none) and at least one workout recorded or changed on this phone after it.
 */
export function isBackupDue(
  lastExportAt: IsoDateTime | null,
  installedAt: IsoDateTime,
  workouts: Pick<Workout, "status" | "updated_at" | "is_demo">[],
  now: Date = new Date(),
): boolean {
  const since = lastExportAt ?? installedAt;
  if (now.getTime() - new Date(since).getTime() <= BACKUP_REMINDER_DAYS * 24 * 3600 * 1000) return false;
  return workouts.some((w) => !w.is_demo && w.status !== "in_progress" && w.updated_at > since);
}
