import { describe, expect, it } from "vitest";
import { backupRow, backupStatus, unsentWorkouts } from "./backup-status";

// Local time: the formatted days and times are the phone's own.
const now = new Date(2026, 10, 2, 19, 0);
const today = new Date(2026, 10, 2, 18, 42).toISOString();
const oct6 = new Date(2026, 9, 6, 9, 15).toISOString();
const oct28 = new Date(2026, 9, 28, 20, 0).toISOString();
const ok = { ok: true };

describe("backupStatus", () => {
  it("automatic copy works: saved, with the day of the copy sent away", () => {
    expect(backupStatus({ pref: "on", folder: ok, autoLastAt: today, exportAt: oct6, unsent: 3, now })).toEqual({
      kind: "saved",
      title: "Данные сохранены",
      text: "Автокопия: сегодня, 18:42. Вне телефона — 6 окт.",
    });
  });

  it("automatic copy works, nothing sent yet", () => {
    expect(backupStatus({ pref: "on", folder: ok, autoLastAt: oct28, exportAt: null, unsent: 0, now }).text).toBe(
      "Автокопия: 28 окт, 20:00. Вне телефона — ещё не отправляли.",
    );
  });

  it("on, but nothing to copy yet", () => {
    expect(backupStatus({ pref: "on", folder: ok, autoLastAt: null, exportAt: null, unsent: 0, now }).kind).toBe("waiting");
  });

  it("the folder is gone: broken, with the last automatic copy", () => {
    expect(backupStatus({ pref: "on", folder: { ok: false }, autoLastAt: oct28, exportAt: oct6, unsent: 0, now })).toEqual({
      kind: "broken",
      title: "Автокопия не сохраняется",
      text: "Нет доступа к папке. Последняя автокопия — 28 окт.",
    });
  });

  it("off: only the copy sent by hand, and how many workouts came after it", () => {
    expect(backupStatus({ pref: "off", folder: ok, autoLastAt: today, exportAt: oct6, unsent: 7, now })).toEqual({
      kind: "manual",
      title: "Копия — только вручную",
      text: "Последняя: 6 окт, 09:15, отправлена. С тех пор — 7 тренировок без копии.",
    });
    expect(backupStatus({ pref: "off", folder: null, autoLastAt: null, exportAt: oct6, unsent: 1, now }).text).toContain("1 тренировка без копии");
    expect(backupStatus({ pref: null, folder: null, autoLastAt: null, exportAt: oct6, unsent: 0, now }).text).toBe("Последняя: 6 окт, 09:15, отправлена.");
  });

  it("off and never sent", () => {
    expect(backupStatus({ pref: "off", folder: null, autoLastAt: null, exportAt: null, unsent: 2, now }).text).toBe(
      "Копию ещё не отправляли: 2 тренировки — только в этом телефоне.",
    );
    expect(backupStatus({ pref: null, folder: null, autoLastAt: null, exportAt: null, unsent: 0, now }).text).toBe("Копию ещё не отправляли.");
  });

  it("on without a folder counts as by hand", () => {
    expect(backupStatus({ pref: "on", folder: null, autoLastAt: null, exportAt: null, unsent: 0, now }).kind).toBe("manual");
  });
});

describe("backupRow", () => {
  it("shows the freshest copy of either kind", () => {
    expect(backupRow({ pref: "on", folder: ok, autoLastAt: today, exportAt: oct6, now })).toEqual({ sub: "Автокопия включена", hint: "сегодня", danger: false });
    expect(backupRow({ pref: "off", folder: null, autoLastAt: oct28, exportAt: oct6, now })).toEqual({ sub: "Только вручную", hint: "28 окт", danger: false });
    expect(backupRow({ pref: null, folder: null, autoLastAt: null, exportAt: null, now }).hint).toBe("не сохраняли");
  });

  it("marks a broken automatic copy", () => {
    expect(backupRow({ pref: "on", folder: { ok: false }, autoLastAt: oct28, exportAt: null, now })).toEqual({
      sub: "Автокопия не сохраняется",
      hint: "28 окт",
      danger: true,
    });
  });
});

describe("unsentWorkouts", () => {
  const w = (updated_at: string, extra: Partial<{ is_demo: boolean; status: "finished" | "in_progress" }> = {}) => ({
    updated_at,
    is_demo: false,
    status: "finished" as const,
    ...extra,
  });

  it("counts own finished workouts after the last sent copy", () => {
    const list = [w(oct6), w(oct28), w(today), w(today, { is_demo: true }), w(today, { status: "in_progress" })];
    expect(unsentWorkouts(oct6, list)).toBe(2);
    expect(unsentWorkouts(null, list)).toBe(3);
  });
});
