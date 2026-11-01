"use client";

import { useSyncExternalStore } from "react";
import { backupRepo } from "@/db/repos/backup";
import { backupCounts } from "@/domain/backup";
import { AUTO_BACKUP_KEEP, backupFilesNewestFirst, backupFilesToDelete, backupFingerprint, shouldBackupOnOpen } from "@/domain/auto-backup";
import { nowIso } from "@/domain/time";
import { backupFileName } from "@/lib/backup-share";
import { getPlatform, IS_ANDROID } from "@/platform";
import type { BackupFolder } from "@/platform/types";

// Automatic copy into a folder on the phone (APK only, stage A3; mockups АК1–АК4).
// These choices belong to this phone (localStorage), not to the backup file: another phone has its own folder.
const PREF_KEY = "st-auto-backup"; // "on" | "off"; missing — not decided yet, the home card asks (АК1)
const LAST_KEY = "st-auto-backup-at";
const HASH_KEY = "st-auto-backup-hash";
// "1" once this install wrote a copy or restored from a file: until then the folder's copies are someone
// else's (the app before reinstalling) and today's file there is not overwritten.
const OWN_KEY = "st-auto-backup-own";

export type AutoBackupPref = "on" | "off" | null;

export interface AutoBackupState {
  pref: AutoBackupPref;
  /** undefined — not asked yet; null — no folder chosen. */
  folder: BackupFolder | null | undefined;
  lastAt: string | null;
  /** «Позже» on «Автокопия не сохраняется»: hidden until the app is started again. */
  alertHidden: boolean;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice lasts until the app is closed
  }
}

const SERVER: AutoBackupState = { pref: null, folder: undefined, lastAt: null, alertHidden: false };
let state: AutoBackupState | null = null;
const listeners = new Set<() => void>();

function snapshot(): AutoBackupState {
  if (!state) {
    const pref = read(PREF_KEY);
    state = { ...SERVER, pref: pref === "on" || pref === "off" ? pref : null, lastAt: read(LAST_KEY) };
  }
  return state;
}

function update(patch: Partial<AutoBackupState>) {
  state = { ...snapshot(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAutoBackup(): AutoBackupState {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

/** Asks the phone about the folder: at startup, on returning to the app, on the «Автокопия» screen. */
export async function refreshBackupFolder(): Promise<BackupFolder | null> {
  if (!IS_ANDROID) return null;
  const folder = await (await getPlatform()).autoBackup.folder().catch(() => null);
  update({ folder });
  return folder;
}

export function setAutoBackupPref(pref: "on" | "off") {
  write(PREF_KEY, pref);
  update({ pref });
}

export function hideAutoBackupAlert() {
  update({ alertHidden: true });
}

export interface ChooseResult {
  status: "saved" | "cancelled" | "failed" | "empty";
  /** "2026-11-01": the newest copy already in the folder — offered for «Восстановить из файла». */
  latestCopy: string | null;
}

/** «Выбрать папку» / «Сменить папку»: Android's picker; then the copy is on and written right away. */
export async function chooseBackupFolder(): Promise<ChooseResult> {
  const api = (await getPlatform()).autoBackup;
  const folder = await api.chooseFolder();
  if (!folder) return { status: "cancelled", latestCopy: null };
  setAutoBackupPref("on");
  update({ folder, alertHidden: false });
  const result = await runAutoBackup("now");
  if (result === "saved") return { status: "saved", latestCopy: null };
  if (result !== "empty" && result !== "kept") return { status: "failed", latestCopy: null };
  const newest = backupFilesNewestFirst(await api.list().catch(() => []))[0];
  return { status: "empty", latestCopy: newest?.name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null };
}

type Reason = "open" | "finish" | "measurement" | "now";
/** empty — no workouts or measurements of one's own yet: nothing to keep, nothing written. */
/** kept — today's file in the folder was written before this install: left as it is. */
type Result = "saved" | "skipped" | "failed" | "empty" | "kept";

let queue: Promise<unknown> = Promise.resolve();

/**
 * Writes today's copy into the folder and keeps the latest 5 days. On opening the app — only if the data
 * changed and an hour has passed (shouldBackupOnOpen); after «Завершить», a measurement or «Сохранить сейчас» —
 * always. Runs one at a time.
 */
export function runAutoBackup(reason: Reason): Promise<Result> {
  const run = queue.then(() => backupOnce(reason));
  queue = run.catch(() => {});
  return run;
}

async function backupOnce(reason: Reason): Promise<Result> {
  if (!IS_ANDROID || snapshot().pref !== "on") return "skipped";
  const api = (await getPlatform()).autoBackup;
  const folder = await api.folder().catch(() => null);
  update({ folder });
  if (!folder) return "skipped";
  if (!folder.ok) return "failed";

  const backup = await backupRepo.exportAll();
  // A fresh install (or demo data only) must not write: today's file in the folder may be the copy
  // the person is about to restore after reinstalling, and an empty one would replace it.
  const own = backupCounts(backup);
  if (own.workouts === 0 && own.measurements === 0) return "empty";
  const hash = backupFingerprint(backup);
  if (reason === "open" && !shouldBackupOnOpen(read(LAST_KEY), read(HASH_KEY), hash)) {
    // Nothing changed — unless the folder lost its copies (emptied, or re-created after the alert).
    const files = await api.list().catch(() => null);
    if (!files || backupFilesNewestFirst(files).length > 0) return "skipped";
  }
  const name = backupFileName();
  if (!read(OWN_KEY) && !read(LAST_KEY)) {
    // After reinstalling, a workout or a measurement before «Восстановить из файла» must not replace
    // today's copy of everything with a copy of that one entry.
    const files = await api.list().catch(() => null);
    if (!files) return "failed";
    if (files.some((f) => f.name === name)) return "kept";
  }
  try {
    await api.write(name, JSON.stringify(backup));
    const old = backupFilesToDelete((await api.list()).map((f) => f.name), AUTO_BACKUP_KEEP);
    if (old.length) await api.remove(old);
  } catch (err) {
    console.error(err);
    update({ folder: { ...folder, ok: false } });
    return "failed";
  }
  const at = nowIso();
  write(LAST_KEY, at);
  write(HASH_KEY, hash);
  write(OWN_KEY, "1");
  update({ lastAt: at });
  return "saved";
}

/** After «Восстановить из файла»: the data is this install's now, and the copy follows it right away. */
export function autoBackupAfterRestore() {
  if (!IS_ANDROID) return;
  write(OWN_KEY, "1");
  runAutoBackup("now").catch(console.error);
}

/** After saving a workout or a measurement: in the background, never in the way of the screen. */
export function autoBackupAfter(reason: "finish" | "measurement") {
  if (IS_ANDROID) runAutoBackup(reason).catch(console.error);
}
