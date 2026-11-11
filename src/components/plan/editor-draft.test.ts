import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, DRAFT_TTL_MS, markQuietReturn, readDraft, takeQuietReturn, writeDraft, type EditorDraft } from "./editor-draft";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
  globalThis.sessionStorage = globalThis.localStorage;
});

const DRAFT: EditorDraft = { name: "Ноги", rows: [], rest: { format: "rest", rest_set_sec: 90, rest_exercise_sec: 120 }, circuits: [] };

describe("plan editor draft (stage 50а)", () => {
  it("comes back for the same saved plan within 12 hours", () => {
    writeDraft("p1", "base", DRAFT, 1000);
    expect(readDraft("p1", "base", 2000)).toEqual(DRAFT);
    expect(readDraft("p2", "base", 2000)).toBeNull();
  });

  it("is dropped when the plan changed since, when too old, or cleared", () => {
    writeDraft("p1", "base", DRAFT, 0);
    expect(readDraft("p1", "other", 10)).toBeNull();
    expect(store.size).toBe(0);
    writeDraft("p1", "base", DRAFT, 0);
    expect(readDraft("p1", "base", DRAFT_TTL_MS + 1)).toBeNull();
    writeDraft(null, "base", DRAFT, 0);
    clearDraft(null);
    expect(readDraft(null, "base", 1)).toBeNull();
  });

  it("a broken record is ignored", () => {
    store.set("plan-editor-draft:p1", "{oops");
    expect(readDraft("p1", "base")).toBeNull();
  });

  it("«История и график»: the return is quiet once, for the same plan only (stage 50)", () => {
    markQuietReturn("p1");
    expect(takeQuietReturn("p2")).toBe(false);
    markQuietReturn("p1");
    expect(takeQuietReturn("p1")).toBe(true);
    expect(takeQuietReturn("p1")).toBe(false);
    markQuietReturn(null);
    expect(takeQuietReturn(null)).toBe(true);
  });
});
