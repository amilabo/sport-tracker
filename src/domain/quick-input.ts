import { MAX_SETS } from "./sets";
import type { LogType, SetValues } from "./types";

/**
 * Quick set entry for the plan editor (PRD §3.2): "4 × 12 × 20 кг" creates four equal sets.
 * Also: "4 × 12", "40×12, 45×10, 50×8", "3 × 15", "4 × 10 × −20", "3 × 0:30", "0,5 мин", "15 мин × 10 км/ч".
 * Separators: × x х * between values; comma or semicolon between groups; decimal comma inside numbers.
 */

export type QuickInputResult = { ok: true; sets: SetValues[] } | { ok: false; error: string };

type Unit = "kg" | "reps" | "min" | "sec" | "kmh" | null;
interface Token {
  value: number;
  unit: Unit;
  /** Written as m:ss */
  clock: boolean;
  signed: boolean;
}

export const QUICK_INPUT_EXAMPLES: Record<LogType, string> = {
  weight_reps: "4 × 12 × 20",
  reps: "3 × 15",
  bodyweight_plus: "4 × 10 × −20",
  time: "3 × 0:30",
  cardio: "15 мин × 10 км/ч",
};

export const QUICK_INPUT_LABELS: Record<LogType, string> = {
  weight_reps: "Быстрый ввод: подходы × раз × вес",
  reps: "Быстрый ввод: подходы × раз",
  bodyweight_plus: "Быстрый ввод: подходы × раз × доп. вес (− помощь)",
  time: "Быстрый ввод: подходы × время",
  cardio: "Быстрый ввод: время × скорость",
};

const UNIT_ALIASES: Record<string, Unit> = {
  кг: "kg", kg: "kg",
  раз: "reps", р: "reps", повт: "reps", раза: "reps",
  мин: "min", м: "min", min: "min",
  сек: "sec", с: "sec", s: "sec", sec: "sec",
  "км/ч": "kmh", кмч: "kmh", км: "kmh", "km/h": "kmh",
};

const TOKEN_RE = /^(?:(\d+):(\d{1,2})|([+-]?\d+(?:\.\d+)?))\s*([a-zа-я/]+)?\.?$/;

function parseToken(raw: string): Token | null {
  const m = raw.trim().match(TOKEN_RE);
  if (!m) return null;
  const unitText = m[4];
  const unit = unitText === undefined ? null : UNIT_ALIASES[unitText];
  if (unit === undefined) return null;
  if (m[1] !== undefined) {
    const sec = Number(m[2]);
    if (sec >= 60) return null;
    return { value: Number(m[1]) * 60 + sec, unit: unit ?? "sec", clock: true, signed: false };
  }
  return { value: Number(m[3]), unit, clock: false, signed: /^[+-]/.test(m[3]) };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[−–—]/g, "-")
    .replace(/[xх*×]/g, "×")
    .replace(/\s+/g, " ")
    .trim();
}

const isCount = (t: Token) => Number.isInteger(t.value) && t.value >= 1 && t.value <= MAX_SETS && t.unit === null && !t.signed && !t.clock;
const isReps = (t: Token) => Number.isInteger(t.value) && t.value >= 1 && t.value <= 999 && (t.unit === null || t.unit === "reps") && !t.signed && !t.clock;

function toSeconds(t: Token, bareUnit: "min" | "sec"): number | null {
  if (t.clock) return t.value;
  const unit = t.unit ?? bareUnit;
  if (unit === "min") return Math.round(t.value * 60);
  if (unit === "sec") return Math.round(t.value);
  return null;
}

function repeat(n: number, set: SetValues): SetValues[] {
  return Array.from({ length: n }, () => ({ ...set }));
}

function weightFrom(t: Token, logType: LogType): number | null {
  if (t.clock || (t.unit !== null && t.unit !== "kg")) return null;
  if (logType === "weight_reps" && t.value < 0) return null;
  if (Math.abs(t.value) > 999) return null;
  return Math.round(t.value * 100) / 100;
}

/** Parses one comma-free group into one or more equal sets. */
function parseGroup(group: string, logType: LogType, inList: boolean): SetValues[] | null {
  const tokens = group.split("×").map(parseToken);
  if (tokens.length === 0 || tokens.some((t) => t === null)) return null;
  const t = tokens as Token[];

  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus": {
      const kgIdx = t.findIndex((x) => x.unit === "kg");
      if (t.length === 3) {
        // N × reps × weight; a "кг" mark may put the weight anywhere.
        const wIdx = kgIdx >= 0 ? kgIdx : 2;
        const rest = t.filter((_, i) => i !== wIdx);
        const [n, reps] = rest;
        const weight = weightFrom(t[wIdx], logType);
        if (!isCount(n) || !isReps(reps) || weight === null) return null;
        return repeat(n.value, { weight, reps: reps.value, duration_sec: null, speed_kmh: null });
      }
      if (t.length === 2) {
        // In a list ("40×12, 45×10") or with a hint (кг, a sign, "12 раз × 40", a first number too big
        // to be a set count) the pair is weight × reps; a lone "4 × 12" or "4 × 12 раз" means sets × reps.
        const repsIdx = t.findIndex((x) => x.unit === "reps");
        const pair = inList || kgIdx >= 0 || repsIdx === 0 || t.some((x) => x.signed) || !isCount(t[0]);
        if (pair) {
          const wIdx = kgIdx >= 0 ? kgIdx : repsIdx >= 0 ? 1 - repsIdx : 0;
          const weight = weightFrom(t[wIdx], logType);
          const reps = t[1 - wIdx];
          if (weight === null || !isReps(reps)) return null;
          return [{ weight, reps: reps.value, duration_sec: null, speed_kmh: null }];
        }
        // N × reps, weight not set
        if (!isCount(t[0]) || !isReps(t[1])) return null;
        return repeat(t[0].value, { weight: null, reps: t[1].value, duration_sec: null, speed_kmh: null });
      }
      if (t.length === 1 && isReps(t[0])) return [{ weight: null, reps: t[0].value, duration_sec: null, speed_kmh: null }];
      return null;
    }

    case "reps": {
      if (t.length === 2 && isCount(t[0]) && isReps(t[1])) {
        return repeat(t[0].value, { weight: null, reps: t[1].value, duration_sec: null, speed_kmh: null });
      }
      if (t.length === 1 && isReps(t[0])) return [{ weight: null, reps: t[0].value, duration_sec: null, speed_kmh: null }];
      return null;
    }

    case "time": {
      const [n, d] = t.length === 2 ? t : t.length === 1 ? [null, t[0]] : [undefined, undefined];
      if (d === undefined || (n !== null && (n === undefined || !isCount(n)))) return null;
      const sec = toSeconds(d, "sec");
      if (sec === null || sec <= 0 || sec > 24 * 3600 || d.signed) return null;
      return repeat(n ? n.value : 1, { weight: null, reps: null, duration_sec: sec, speed_kmh: null });
    }

    case "cardio": {
      // [N ×] duration [× speed]; units may come in any order.
      let rest = t;
      let n = 1;
      if (rest.length === 3) {
        if (!isCount(rest[0])) return null;
        n = rest[0].value;
        rest = rest.slice(1);
      }
      if (rest.length === 0 || rest.length > 2) return null;
      let durTok = rest[0];
      let speedTok: Token | undefined = rest[1];
      if (rest.length === 2 && (rest[0].unit === "kmh" || rest[1].clock || rest[1].unit === "min" || rest[1].unit === "sec")) {
        [durTok, speedTok] = [rest[1], rest[0]];
      }
      if (durTok.unit === "kmh" && rest.length === 1) return null;
      const sec = toSeconds(durTok, "min");
      if (sec === null || sec <= 0 || sec > 24 * 3600 || durTok.signed) return null;
      let speed: number | null = null;
      if (speedTok) {
        if (speedTok.clock || (speedTok.unit !== null && speedTok.unit !== "kmh") || speedTok.value <= 0 || speedTok.value > 50 || speedTok.signed) return null;
        speed = Math.round(speedTok.value * 10) / 10;
      }
      return repeat(n, { weight: null, reps: null, duration_sec: sec, speed_kmh: speed });
    }
  }
}

function parseGroups(text: string, logType: LogType): SetValues[] | null {
  const groups = text.split(/[;,]/).map((g) => g.trim()).filter(Boolean);
  if (groups.length === 0) return null;
  const sets: SetValues[] = [];
  for (const g of groups) {
    const parsed = parseGroup(g, logType, groups.length > 1);
    if (!parsed) return null;
    sets.push(...parsed);
  }
  return sets.length <= MAX_SETS ? sets : null;
}

export function parseQuickInput(text: string, logType: LogType): QuickInputResult {
  const s = normalize(text);
  if (!s) return { ok: true, sets: [] };
  // First read every "12,5" as a decimal. If that fails, keep only single-digit fractions ("42,5")
  // as decimals and read the other commas as separators ("40×12,45×10").
  const sets =
    parseGroups(s.replace(/(\d),(\d)/g, "$1.$2"), logType) ??
    parseGroups(s.replace(/(\d),(\d)(?!\d)/g, "$1.$2"), logType);
  if (sets) return { ok: true, sets };
  return { ok: false, error: `Не понял запись — пример: ${QUICK_INPUT_EXAMPLES[logType]}` };
}
