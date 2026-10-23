import { seriesOf, valueOf, type BodySession, type SeriesPoint } from "./body";
import type { LocalDate, MeasurementType } from "./types";

// The «Тело» summary and table (PRD §3.10, v1.9): one switch picks the two dates every change is counted between.

export type BodyPeriod = "last" | "3m" | "all" | "custom";

export const BODY_PERIODS: { id: BodyPeriod; label: string }[] = [
  { id: "last", label: "Прошлый" },
  { id: "3m", label: "3 мес" },
  { id: "all", label: "С начала" },
  { id: "custom", label: "Даты" },
];

/** «2026-09-29» minus n calendar months; the day is clamped to the month's length (31.05 − 3 → 28.02). */
export function minusMonths(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) - n;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return `${ty}-${String(tm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export interface PeriodDates {
  /** «Было»: null when there is nothing earlier to compare with. */
  a: LocalDate | null;
  /** «Стало»: null only without sessions. */
  b: LocalDate | null;
}

/**
 * The two session dates of a period. Sessions are newest first.
 * «3 мес» — the latest session at least 3 months before «стало»; if the history is shorter, the first one.
 */
export function periodDates(sessions: BodySession[], period: BodyPeriod, custom?: PeriodDates): PeriodDates {
  if (!sessions.length) return { a: null, b: null };
  if (period === "custom" && custom?.b) return { a: custom.a && custom.a < custom.b ? custom.a : null, b: custom.b };
  const b = sessions[0].date;
  const older = sessions.filter((s) => s.date < b);
  if (!older.length) return { a: null, b };
  if (period === "3m") {
    const edge = minusMonths(b, 3);
    return { a: older.find((s) => s.date <= edge)?.date ?? older.at(-1)!.date, b };
  }
  if (period === "all") return { a: older.at(-1)!.date, b };
  return { a: older[0].date, b };
}

export interface BodyView {
  period: BodyPeriod;
  /** null — «Даты» starts from the pair «Прошлый» shows. */
  custom: PeriodDates | null;
}

/**
 * The switch as saved in settings (and in a backup file, which may come from another phone or be old):
 * an unknown period means «Прошлый»; «Даты» whose sessions are gone fall back to the «Прошлый» pair.
 */
export function restoreBodyView(sessions: BodySession[], period: string | undefined, custom: PeriodDates | null | undefined): BodyView {
  const known = BODY_PERIODS.find((p) => p.id === period)?.id ?? "last";
  const has = (d: LocalDate | null) => d !== null && sessions.some((s) => s.date === d);
  const valid = !!custom && has(custom.b) && (custom.a === null || (has(custom.a) && custom.a < custom.b!));
  return { period: known, custom: valid ? { a: custom!.a, b: custom!.b } : null };
}

export interface ComparePoint {
  value: number;
  date: LocalDate;
  /** Calculated (BMI, % from kg) rather than typed in. */
  computed: boolean;
}

export interface CompareRow {
  type: MeasurementType;
  a: ComparePoint | null;
  b: ComparePoint | null;
  /** b − a, rounded to 0.1; null when either side is missing. */
  delta: number | null;
  /** Oldest first: all values of the type, for the sparkline. */
  series: SeriesPoint[];
}

/** The type's value on the latest session on or before date. */
function valueAt(type: MeasurementType, sessions: BodySession[], types: MeasurementType[], height: number | null, date: LocalDate): ComparePoint | null {
  for (const s of sessions) {
    if (s.date > date) continue;
    const v = valueOf(type, s, types, height);
    if (v) return { value: v.value, date: s.date, computed: v.computed };
  }
  return null;
}

/**
 * «Было» and «стало» of one type. A type is not measured on every date (the club scales give only weight,
 * fat and muscle), so each side takes the type's nearest value: «стало» — its last value on or before b;
 * «было» — its last value on or before a, or, if it was first measured later, its first value after a.
 */
export function compareType(type: MeasurementType, sessions: BodySession[], types: MeasurementType[], height: number | null, dates: PeriodDates): CompareRow {
  const series = seriesOf(type, sessions, types, height);
  const b = dates.b ? valueAt(type, sessions, types, height, dates.b) : null;
  let a: ComparePoint | null = null;
  if (dates.a && b) {
    a = valueAt(type, sessions, types, height, dates.a);
    if (!a) {
      const first = series.find((p) => p.date > dates.a! && p.date < b.date);
      if (first) {
        const s = sessions.find((x) => x.date === first.date)!;
        a = { value: first.value, date: first.date, computed: valueOf(type, s, types, height)!.computed };
      }
    }
    if (a && a.date >= b.date) a = null;
  }
  return { type, a, b, delta: a && b ? Math.round((b.value - a.value) * 10) / 10 : null, series };
}

export interface BodyGroup {
  title: string;
  rows: CompareRow[];
}

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Масса", keys: ["weight", "bmi"] },
  { title: "Состав", keys: ["fat_kg", "fat_pct", "muscle_kg", "muscle_pct"] },
  { title: "Объёмы", keys: ["waist", "hips", "chest", "belly", "thigh"] },
];

/** Table groups: built-in types in the screen order, own types last. Only types that have any value. */
export function compareGroups(types: MeasurementType[], sessions: BodySession[], height: number | null, dates: PeriodDates): BodyGroup[] {
  const known = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = [
    ...GROUPS.map((g) => ({ title: g.title, types: g.keys.map((k) => types.find((t) => t.key === k)).filter((t): t is MeasurementType => !!t) })),
    { title: "Свои", types: types.filter((t) => !known.has(t.key ?? "")) },
  ];
  return groups
    .map((g) => ({ title: g.title, rows: g.types.map((t) => compareType(t, sessions, types, height, dates)).filter((r) => r.series.length > 0) }))
    .filter((g) => g.rows.length > 0);
}

export interface CompositionPart {
  key: "fat" | "muscle" | "rest";
  name: string;
  kg: number;
  /** Share of the body weight, %. */
  pct: number;
  /** Change in kg between the period dates; null without a comparable earlier session. */
  delta: number | null;
}

export interface Composition {
  date: LocalDate;
  weight: number;
  parts: CompositionPart[];
}

/** The body as weight = fat + muscle + the rest, from one session that has weight and at least fat or muscle. */
function partsOf(session: BodySession, ids: { weight?: string; fat?: string; muscle?: string }) {
  const w = ids.weight ? session.entered.get(ids.weight) : undefined;
  const fat = ids.fat ? session.entered.get(ids.fat) : undefined;
  const muscle = ids.muscle ? session.entered.get(ids.muscle) : undefined;
  if (w === undefined || w <= 0 || (fat === undefined && muscle === undefined)) return null;
  const rest = w - (fat ?? 0) - (muscle ?? 0);
  if (rest < 0) return null;
  return { weight: w, fat, muscle, rest };
}

/**
 * Composition bar of the «стало» side: the latest session on or before b with weight and fat or muscle.
 * The change is counted against the same kind of session on or before a.
 */
export function composition(types: MeasurementType[], sessions: BodySession[], dates: PeriodDates): Composition | null {
  if (!dates.b) return null;
  const ids = {
    weight: types.find((t) => t.key === "weight")?.id,
    fat: types.find((t) => t.key === "fat_kg")?.id,
    muscle: types.find((t) => t.key === "muscle_kg")?.id,
  };
  const at = (date: LocalDate) => {
    for (const s of sessions) {
      if (s.date > date) continue;
      const p = partsOf(s, ids);
      if (p) return { date: s.date, ...p };
    }
    return null;
  };
  const now = at(dates.b);
  if (!now) return null;
  const before = dates.a ? at(dates.a) : null;
  const was = before && before.date < now.date ? before : null;
  const round = (v: number) => Math.round(v * 10) / 10;
  const diff = (x: number | undefined, y: number | undefined) => (x === undefined || y === undefined ? null : round(x - y));
  const parts: CompositionPart[] = [];
  if (now.fat !== undefined) parts.push({ key: "fat", name: "Жир", kg: now.fat, pct: (now.fat / now.weight) * 100, delta: diff(now.fat, was?.fat) });
  if (now.muscle !== undefined) parts.push({ key: "muscle", name: "Мышцы", kg: now.muscle, pct: (now.muscle / now.weight) * 100, delta: diff(now.muscle, was?.muscle) });
  const sameParts = was && (was.fat === undefined) === (now.fat === undefined) && (was.muscle === undefined) === (now.muscle === undefined);
  parts.push({ key: "rest", name: "Прочее", kg: round(now.rest), pct: (now.rest / now.weight) * 100, delta: sameParts ? diff(now.rest, was!.rest) : null });
  return { date: now.date, weight: now.weight, parts };
}

/** Number of values typed in a session (computed BMI and % are not counted). */
export function enteredCount(session: BodySession): number {
  return session.entered.size;
}
