import type { BackupFile } from "./backup";

// Automatic copy into a folder on the phone (APK only, stage A3; mockups АК1–АК4).

/** Files of this many latest days stay in the folder; older ones are deleted. */
export const AUTO_BACKUP_KEEP = 5;

/** On opening the app a copy is written at most this often — and only if something changed. */
export const AUTO_BACKUP_OPEN_GAP_MS = 60 * 60 * 1000;

const FILE_NAME = /^sport-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/;

/**
 * What the data looks like, as a short hash: equal for equal data. The time of the last copy
 * (settings.last_export_at, exported_at) is left out — saving a copy alone is not a change worth a new one.
 */
export function backupFingerprint(file: BackupFile): string {
  const settings = file.data.settings?.map((s) => ({ ...s, last_export_at: null }));
  const text = JSON.stringify({ ...file.data, settings });
  // FNV-1a, 32 bit: a change detector, not a checksum against tampering.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

/** On opening: never copied yet, or an hour has passed since the last copy and the data changed. */
export function shouldBackupOnOpen(lastAt: string | null, lastHash: string | null, hash: string, now: Date = new Date()): boolean {
  if (!lastAt) return true;
  if (hash === lastHash) return false;
  return now.getTime() - new Date(lastAt).getTime() >= AUTO_BACKUP_OPEN_GAP_MS;
}

/** Copy files in the folder beyond the newest `keep` days (other files there are never touched). */
export function backupFilesToDelete(names: string[], keep: number = AUTO_BACKUP_KEEP): string[] {
  return names
    .filter((n) => FILE_NAME.test(n))
    .sort()
    .reverse()
    .slice(keep);
}

/** Our copy files only, newest day first. */
export function backupFilesNewestFirst<T extends { name: string }>(files: T[]): T[] {
  return files.filter((f) => FILE_NAME.test(f.name)).sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

/** The later of two moments (either may be missing): the last copy of any kind, for «Давно не сохраняли копию». */
export function latestOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
