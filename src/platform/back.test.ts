import { describe, expect, it, vi } from "vitest";
import { pushBackGuard, runBackGuard } from "./back";

describe("back guard", () => {
  it("does nothing without guards", () => {
    expect(runBackGuard()).toBe(false);
  });

  it("runs the newest guard only, and the previous one after it is removed", () => {
    const plan = vi.fn();
    const draft = vi.fn();
    const offPlan = pushBackGuard(plan);
    const offDraft = pushBackGuard(draft);

    expect(runBackGuard()).toBe(true);
    expect(draft).toHaveBeenCalledTimes(1);
    expect(plan).not.toHaveBeenCalled();

    offDraft();
    expect(runBackGuard()).toBe(true);
    expect(plan).toHaveBeenCalledTimes(1);

    offPlan();
    expect(runBackGuard()).toBe(false);
  });

  it("removing twice is harmless", () => {
    const off = pushBackGuard(() => {});
    off();
    off();
    expect(runBackGuard()).toBe(false);
  });
});
