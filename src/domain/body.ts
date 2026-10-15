import { formatNumber, parseDecimal } from "./format";
import type { Id, LocalDate, Measurement, MeasurementType } from "./types";

// Body measurements (PRD §3.10): a session is one date with values of any types.

export interface BodySession {
  date: LocalDate;
  /** Entered values by type id. */
  entered: Map<Id, number>;
}

export function groupSessions(measurements: Measurement[]): BodySession[] {
  const byDate = new Map<LocalDate, Map<Id, number>>();
  for (const m of measurements) {
    if (!byDate.has(m.date)) byDate.set(m.date, new Map());
    byDate.get(m.date)!.set(m.measurement_type_id, m.value);
  }
  return [...byDate.entries()].map(([date, entered]) => ({ date, entered })).sort((a, b) => b.date.localeCompare(a.date));
}

export interface BodyValue {
  value: number;
  /** Calculated (BMI, % from kg) rather than typed in. */
  computed: boolean;
}

/**
 * The value of a type on a date: what was entered, otherwise computed — BMI from weight and height,
 * a percentage from its kg type and the weight of the same date (PRD §3.10).
 */
export function valueOf(type: MeasurementType, session: BodySession, types: MeasurementType[], heightCm: number | null): BodyValue | null {
  const entered = session.entered.get(type.id);
  if (entered !== undefined && type.computed !== "bmi") return { value: entered, computed: false };
  const weightType = types.find((t) => t.key === "weight");
  const weight = weightType ? session.entered.get(weightType.id) : undefined;
  if (type.computed === "bmi") {
    if (weight === undefined || !heightCm) return null;
    const m = heightCm / 100;
    return { value: Math.round((weight / (m * m)) * 10) / 10, computed: true };
  }
  if (type.computed === "percent_of_weight" && type.base_type_id) {
    const base = session.entered.get(type.base_type_id);
    if (base === undefined || weight === undefined || weight <= 0) return null;
    return { value: Math.round((base / weight) * 1000) / 10, computed: true };
  }
  return null;
}

export interface SeriesPoint {
  date: LocalDate;
  value: number;
}

/** Oldest first, only dates that have a value of this type. */
export function seriesOf(type: MeasurementType, sessions: BodySession[], types: MeasurementType[], heightCm: number | null): SeriesPoint[] {
  return sessions
    .map((s) => ({ date: s.date, v: valueOf(type, s, types, heightCm) }))
    .filter((x): x is { date: LocalDate; v: BodyValue } => x.v !== null)
    .map((x) => ({ date: x.date, value: x.v.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TileLine {
  type: MeasurementType;
  /** The latest value of the type and its date (may be older than the latest session). */
  value: number | null;
  date: LocalDate | null;
  /** Change against the previous session; null when either side is missing. */
  delta: number | null;
}

/**
 * A tile line compares the latest session with the previous one — the two dates in the screen header
 * («Замер 29.09 · стрелки — к 08.09»). A type missing in the latest session shows its last value without an arrow.
 */
export function tileLine(type: MeasurementType, sessions: BodySession[], types: MeasurementType[], heightCm: number | null): TileLine {
  const [latest, previous] = sessions;
  const series = seriesOf(type, sessions, types, heightCm);
  const last = series.at(-1) ?? null;
  const now = latest ? valueOf(type, latest, types, heightCm) : null;
  const before = previous ? valueOf(type, previous, types, heightCm) : null;
  return {
    type,
    value: last?.value ?? null,
    date: last?.date ?? null,
    delta: now && before ? Math.round((now.value - before.value) * 10) / 10 : null,
  };
}

/** «12.05» */
export function shortDate(date: LocalDate): string {
  const [, m, d] = date.split("-");
  return `${d}.${m}`;
}

export function formatBodyValue(value: number): string {
  return formatNumber(value);
}

/** Parses a typed value: positive, ≤ 999, a percentage ≤ 100; empty → null (not saved); invalid → undefined. */
export function parseBodyValue(type: MeasurementType, text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const v = parseDecimal(t);
  if (v === null || v <= 0 || v > 999) return undefined;
  if (type.unit === "%" && v > 100) return undefined;
  return Math.round(v * 100) / 100;
}

/** Types typed in the form: BMI is always computed. */
export function inputTypes(types: MeasurementType[]): MeasurementType[] {
  return types.filter((t) => t.computed !== "bmi" && !t.archived_at);
}
