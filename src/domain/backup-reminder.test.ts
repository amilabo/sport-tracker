import { describe, expect, it } from "vitest";
import { isBackupDue } from "./backup-reminder";

const w = (updated_at: string, status: "finished" | "in_progress" = "finished", is_demo = false) => ({ updated_at, status, is_demo });
const NOW = new Date("2026-10-20T12:00:00.000Z");

describe("isBackupDue", () => {
  it("needs more than 7 days since the last copy and a new finished workout after it", () => {
    expect(isBackupDue("2026-10-10T12:00:00.000Z", "2026-10-01T00:00:00.000Z", [w("2026-10-15T09:00:00.000Z")], NOW)).toBe(true);
    expect(isBackupDue("2026-10-14T12:00:00.000Z", "2026-10-01T00:00:00.000Z", [w("2026-10-15T09:00:00.000Z")], NOW)).toBe(false);
    expect(isBackupDue("2026-10-10T12:00:00.000Z", "2026-10-01T00:00:00.000Z", [w("2026-10-09T09:00:00.000Z")], NOW)).toBe(false);
  });

  it("counts from the first launch when no copy was made; ignores demo and unfinished workouts", () => {
    expect(isBackupDue(null, "2026-10-01T00:00:00.000Z", [w("2026-10-05T09:00:00.000Z")], NOW)).toBe(true);
    expect(isBackupDue(null, "2026-10-18T00:00:00.000Z", [w("2026-10-19T09:00:00.000Z")], NOW)).toBe(false);
    expect(isBackupDue(null, "2026-10-01T00:00:00.000Z", [w("2026-10-05T09:00:00.000Z", "in_progress"), w("2026-10-05T09:00:00.000Z", "finished", true)], NOW)).toBe(false);
  });
});
