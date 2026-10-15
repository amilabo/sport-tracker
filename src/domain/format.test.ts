import { describe, expect, it } from "vitest";
import { EXERCISE_FORMS, formatHeaderDate, formatNumber, formatShortDate, formatTime, parseDecimal, parseDurationInput, plural } from "./format";

describe("formatHeaderDate", () => {
  it("formats weekday and day with genitive month", () => {
    expect(formatHeaderDate(new Date(2026, 9, 15))).toBe("Чт · 15 октября");
    expect(formatHeaderDate(new Date(2026, 0, 4))).toBe("Вс · 4 января");
  });
});

describe("formatNumber", () => {
  it("uses a decimal comma and drops trailing zeros", () => {
    expect(formatNumber(42.5)).toBe("42,5");
    expect(formatNumber(40)).toBe("40");
    expect(formatNumber(17.25)).toBe("17,3");
  });
});

describe("plural", () => {
  it("picks the Russian plural form", () => {
    const f = (n: number) => `${n} ${plural(n, EXERCISE_FORMS)}`;
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map(f)).toEqual([
      "1 упражнение", "2 упражнения", "5 упражнений", "11 упражнений", "12 упражнений",
      "21 упражнение", "22 упражнения", "25 упражнений", "101 упражнение", "111 упражнений",
    ]);
  });
});

describe("short date and time", () => {
  it("formats like the mockups", () => {
    expect(formatShortDate(new Date(2026, 9, 5, 9, 24))).toBe("пн, 5 окт");
    expect(formatTime(new Date(2026, 9, 5, 9, 4))).toBe("09:04");
  });
});

describe("parseDecimal", () => {
  it("accepts comma and dot, rejects junk", () => {
    expect(parseDecimal("42,5")).toBe(42.5);
    expect(parseDecimal(" 40 ")).toBe(40);
    expect(parseDecimal("−20")).toBe(-20);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("4a")).toBeNull();
  });
});

describe("parseDurationInput", () => {
  it("reads m:ss and bare numbers in the field unit", () => {
    expect(parseDurationInput("1:30", "sec")).toBe(90);
    expect(parseDurationInput("45", "sec")).toBe(45);
    expect(parseDurationInput("15", "min")).toBe(900);
    expect(parseDurationInput("1,5", "min")).toBe(90);
    expect(parseDurationInput("15:30", "min")).toBe(930);
    expect(parseDurationInput("1:75", "sec")).toBeNull();
    expect(parseDurationInput("abc", "sec")).toBeNull();
  });
});
