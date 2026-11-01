import { describe, expect, it } from "vitest";
import {
  AUTO_BACKUP_OPEN_GAP_MS,
  backupFilesNewestFirst,
  backupFilesToDelete,
  backupFingerprint,
  latestOf,
  shouldBackupOnOpen,
} from "./auto-backup";
import type { BackupFile } from "./backup";

function file(data: Record<string, unknown[]>, exportedAt = "2026-11-01T10:00:00.000Z"): BackupFile {
  return { app: "sport-tracker", format: 1, schema_version: 1, exported_at: exportedAt, data } as unknown as BackupFile;
}

describe("backupFingerprint", () => {
  const base = { workouts: [{ id: "w1", note: null }], settings: [{ id: "s", last_export_at: null, weekly_goal: 2 }] };

  it("is the same for the same data, whenever it was exported", () => {
    expect(backupFingerprint(file(base))).toBe(backupFingerprint(file(base, "2026-11-02T10:00:00.000Z")));
  });

  it("ignores the time of the last copy", () => {
    const later = { ...base, settings: [{ id: "s", last_export_at: "2026-11-01T18:42:00.000Z", weekly_goal: 2 }] };
    expect(backupFingerprint(file(later))).toBe(backupFingerprint(file(base)));
  });

  it("changes when a record changes", () => {
    const changed = { ...base, workouts: [{ id: "w1", note: "тяжело" }] };
    expect(backupFingerprint(file(changed))).not.toBe(backupFingerprint(file(base)));
  });

  it("changes when another setting changes", () => {
    const changed = { ...base, settings: [{ id: "s", last_export_at: null, weekly_goal: 3 }] };
    expect(backupFingerprint(file(changed))).not.toBe(backupFingerprint(file(base)));
  });
});

describe("shouldBackupOnOpen", () => {
  const at = "2026-11-01T10:00:00.000Z";
  const now = (ms: number) => new Date(new Date(at).getTime() + ms);

  it("copies when there was no copy yet", () => {
    expect(shouldBackupOnOpen(null, null, "h1", now(0))).toBe(true);
  });

  it("does not copy unchanged data, however long ago", () => {
    expect(shouldBackupOnOpen(at, "h1", "h1", now(10 * AUTO_BACKUP_OPEN_GAP_MS))).toBe(false);
  });

  it("waits an hour after the last copy even if data changed", () => {
    expect(shouldBackupOnOpen(at, "h1", "h2", now(AUTO_BACKUP_OPEN_GAP_MS - 1))).toBe(false);
    expect(shouldBackupOnOpen(at, "h1", "h2", now(AUTO_BACKUP_OPEN_GAP_MS))).toBe(true);
  });
});

describe("backup files in the folder", () => {
  const names = [
    "sport-tracker-backup-2026-10-25.json",
    "sport-tracker-backup-2026-11-01.json",
    "notes.txt",
    "sport-tracker-backup-2026-10-27.json",
    "sport-tracker-backup-2026-10-31.json",
    "sport-tracker-backup-2026-10-20.json",
    "sport-tracker-backup-2026-10-29.json",
    "sport-tracker-backup-2026-11-01 (1).json",
  ];

  it("deletes our files beyond the newest five days and nothing else", () => {
    expect(backupFilesToDelete(names)).toEqual(["sport-tracker-backup-2026-10-20.json"]);
  });

  it("keeps everything while there are five or fewer", () => {
    expect(backupFilesToDelete(names.slice(0, 4))).toEqual([]);
  });

  it("lists our files newest first", () => {
    const listed = backupFilesNewestFirst(names.map((name) => ({ name })));
    expect(listed.map((f) => f.name)).toEqual([
      "sport-tracker-backup-2026-11-01.json",
      "sport-tracker-backup-2026-10-31.json",
      "sport-tracker-backup-2026-10-29.json",
      "sport-tracker-backup-2026-10-27.json",
      "sport-tracker-backup-2026-10-25.json",
      "sport-tracker-backup-2026-10-20.json",
    ]);
  });
});

describe("latestOf", () => {
  it("takes the later moment, or the one that exists", () => {
    expect(latestOf(null, null)).toBe(null);
    expect(latestOf("2026-10-01T00:00:00.000Z", null)).toBe("2026-10-01T00:00:00.000Z");
    expect(latestOf(null, "2026-10-02T00:00:00.000Z")).toBe("2026-10-02T00:00:00.000Z");
    expect(latestOf("2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe("2026-10-02T00:00:00.000Z");
  });
});
