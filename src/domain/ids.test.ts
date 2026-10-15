import { describe, expect, it } from "vitest";
import { seedId, uuid } from "./ids";
import { cleanName, searchKey } from "./text";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  it("returns a v4 uuid", () => {
    expect(uuid()).toMatch(UUID_RE);
  });

  it("works without crypto.randomUUID (insecure context)", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = uuid();
      expect(a).toMatch(UUID_RE);
      expect(a.charAt(14)).toBe("4");
      expect(uuid()).not.toBe(a);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("seedId", () => {
  it("is deterministic and looks like a v5 uuid", () => {
    expect(seedId("exercise:bench_press")).toBe(seedId("exercise:bench_press"));
    expect(seedId("exercise:bench_press")).not.toBe(seedId("exercise:barbell_squat"));
    expect(seedId("x")).toMatch(UUID_RE);
    expect(seedId("x").charAt(14)).toBe("5");
  });
});

describe("text helpers", () => {
  it("cleans names and compares ignoring case and ё", () => {
    expect(cleanName("  Жим \t лёжа ")).toBe("Жим лёжа");
    expect(searchKey("ЖИМ ЛЁЖА")).toBe(searchKey("жим лежа"));
  });
});
