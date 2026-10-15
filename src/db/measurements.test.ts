import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./client";
import { measurementsRepo } from "./repos/measurements";
import { measurementTypeSeedId } from "./seed";

beforeEach(resetDbForTests);
afterEach(resetDbForTests);

const W = measurementTypeSeedId("weight");
const WAIST = measurementTypeSeedId("waist");

describe("measurementsRepo sessions", () => {
  it("saves, edits (emptied field removes the value), moves and deletes a date", async () => {
    await measurementsRepo.saveSession("2026-09-29", new Map([[W, 68.5], [WAIST, 72.5]]));
    await measurementsRepo.saveSession("2026-09-29", new Map([[W, 68.4], [WAIST, null]]));
    let all = await measurementsRepo.list();
    expect(all.map((m) => [m.date, m.value])).toEqual([["2026-09-29", 68.4]]);

    await measurementsRepo.saveSession("2026-09-28", new Map([[W, 68.4]]), "2026-09-29");
    all = await measurementsRepo.list();
    expect(all.map((m) => m.date)).toEqual(["2026-09-28"]);

    await measurementsRepo.deleteSession("2026-09-28");
    expect(await measurementsRepo.list()).toEqual([]);
  });

  it("refuses an empty session, a future date and moving onto a taken date", async () => {
    await expect(measurementsRepo.saveSession("2026-09-29", new Map([[W, null]]))).rejects.toThrow("хотя бы одно");
    await expect(measurementsRepo.saveSession("2999-01-01", new Map([[W, 70]]))).rejects.toThrow("в будущем");
    await measurementsRepo.saveSession("2026-09-08", new Map([[W, 68.9]]));
    await measurementsRepo.saveSession("2026-09-29", new Map([[W, 68.5]]));
    await expect(measurementsRepo.saveSession("2026-09-08", new Map([[W, 70]]), "2026-09-29")).rejects.toThrow("уже есть замер");
  });
});
