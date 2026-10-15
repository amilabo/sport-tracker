import { formatNumber } from "./format";
import type { LogType, SetValues } from "./types";

export const MAX_SETS = 20;

export function emptySet(): SetValues {
  return { weight: null, reps: null, duration_sec: null, speed_kmh: null };
}

/** "0:30", "1:05", "15:00". */
export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Cardio duration: whole minutes as "15 мин", otherwise "15:30". */
export function formatCardioDuration(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60} мин` : formatClock(sec);
}

function signed(weight: number): string {
  if (weight > 0) return `+${formatNumber(weight)}`;
  if (weight < 0) return `−${formatNumber(-weight)}`;
  return "0";
}

function weightText(logType: LogType, weight: number): string {
  return logType === "bodyweight_plus" ? signed(weight) : formatNumber(weight);
}

function same(a: SetValues, b: SetValues) {
  return a.weight === b.weight && a.reps === b.reps && a.duration_sec === b.duration_sec && a.speed_kmh === b.speed_kmh;
}

/** One set in a chip: "20×12", "12 раз", "−20×10", "0:30", "15 мин · 10 км/ч". */
export function formatSet(logType: LogType, s: SetValues): string {
  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus":
      if (s.weight === null) return `${s.reps ?? "—"} раз`;
      return `${weightText(logType, s.weight)}×${s.reps ?? "—"}`;
    case "reps":
      return `${s.reps ?? "—"} раз`;
    case "time":
      return s.duration_sec === null ? "—" : formatClock(s.duration_sec);
    case "cardio": {
      const parts = [];
      if (s.duration_sec !== null) parts.push(formatCardioDuration(s.duration_sec));
      if (s.speed_kmh !== null) parts.push(`${formatNumber(s.speed_kmh)} км/ч`);
      return parts.join(" · ") || "—";
    }
  }
}

/** Summary of an exercise's sets: "4 × 12 × 20 кг", "40×12 · 45×10 · 50×8 кг", "3 × 0:30", "15 мин · 10 км/ч". */
export function formatSetsSummary(logType: LogType, sets: SetValues[]): string {
  if (sets.length === 0) return "нет подходов";
  const allSame = sets.every((s) => same(s, sets[0]));
  const n = sets.length;
  const s0 = sets[0];

  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus":
      if (allSame) {
        return s0.weight === null
          ? `${n} × ${s0.reps ?? "—"} раз`
          : `${n} × ${s0.reps ?? "—"} × ${weightText(logType, s0.weight)} кг`;
      }
      if (sets.every((s) => s.weight === null)) return `${sets.map((s) => s.reps ?? "—").join(" · ")} раз`;
      return `${sets.map((s) => formatSet(logType, s)).join(" · ")} кг`;
    case "reps":
      return allSame ? `${n} × ${s0.reps ?? "—"} раз` : `${sets.map((s) => s.reps ?? "—").join(" · ")} раз`;
    case "time":
      return allSame ? `${n} × ${formatSet(logType, s0)}` : sets.map((s) => formatSet(logType, s)).join(" · ");
    case "cardio":
      return allSame && n === 1 ? formatSet(logType, s0) : sets.map((s) => formatSet(logType, s)).join(", ");
  }
}

/** The quick-input text that produces these sets (inverse of parseQuickInput). */
export function toQuickInput(logType: LogType, sets: SetValues[]): string {
  if (sets.length === 0) return "";
  const allSame = sets.every((s) => same(s, sets[0]));
  const n = sets.length;
  const s0 = sets[0];
  const w = (x: number) => weightText(logType, x);

  switch (logType) {
    case "weight_reps":
    case "bodyweight_plus":
      if (allSame) return s0.weight === null ? `${n} × ${s0.reps ?? ""}` : `${n} × ${s0.reps ?? ""} × ${w(s0.weight)}`;
      // In a list every pair is weight × reps; a set without weight is written as "12 раз".
      return sets.map((s) => (s.weight === null ? `${s.reps ?? ""} раз` : `${w(s.weight)}×${s.reps ?? ""}`)).join(", ");
    case "reps":
      return allSame ? `${n} × ${s0.reps ?? ""}` : sets.map((s) => s.reps ?? "").join(", ");
    case "time":
      return allSame ? `${n} × ${formatClock(s0.duration_sec ?? 0)}` : sets.map((s) => formatClock(s.duration_sec ?? 0)).join(", ");
    case "cardio": {
      const one = (s: SetValues) =>
        [s.duration_sec !== null ? formatCardioDuration(s.duration_sec) : null, s.speed_kmh !== null ? `${formatNumber(s.speed_kmh)} км/ч` : null]
          .filter(Boolean)
          .join(" × ");
      return allSame ? (n === 1 ? one(s0) : `${n} × ${one(s0)}`) : sets.map(one).join(", ");
    }
  }
}
