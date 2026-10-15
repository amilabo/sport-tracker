const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Чт · 15 октября" — the date line above a section title. */
export function formatHeaderDate(date: Date) {
  return `${capitalize(WEEKDAYS_SHORT[date.getDay()])} · ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** Numbers use a decimal comma and at most one fractional digit: 42.5 → "42,5". */
export function formatNumber(value: number, fractionDigits = 1) {
  const factor = 10 ** fractionDigits;
  return String(Math.round(value * factor) / factor).replace(".", ",");
}

/** Russian plural form: plural(3, ["упражнение", "упражнения", "упражнений"]) → "упражнения". */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

export const EXERCISE_FORMS: [string, string, string] = ["упражнение", "упражнения", "упражнений"];

/** "пн, 5 окт" — compact date of a workout. */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "09:24" in local time. */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Parses user input with a decimal comma or dot: "42,5" → 42.5; empty or invalid → null. */
export function parseDecimal(text: string): number | null {
  const s = text.trim().replace(",", ".").replace(/[−–]/g, "-");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Typed duration: "1:30" → 90 s; a bare number is seconds or minutes depending on the field. */
export function parseDurationInput(text: string, bareUnit: "sec" | "min"): number | null {
  const s = text.trim();
  const clock = s.match(/^(\d+):(\d{1,2})$/);
  if (clock) {
    const sec = Number(clock[2]);
    return sec < 60 ? Number(clock[1]) * 60 + sec : null;
  }
  const n = parseDecimal(s);
  if (n === null || n < 0) return null;
  return Math.round(bareUnit === "min" ? n * 60 : n);
}
