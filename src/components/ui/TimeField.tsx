"use client";

import { inputClass } from "./Field";

interface TimeFieldProps {
  label: string;
  /** "HH:MM", 24-hour. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

/** Formats typed digits as "ЧЧ:ММ": "0924" → "09:24"; the colon appears after the second digit. */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** Always 24-hour time input. The native <input type="time"> follows the phone's 12/24-hour setting (AM/PM). */
export function TimeField({ label, value, onChange, invalid }: TimeFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="ЧЧ:ММ"
        maxLength={5}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(mask(e.target.value))}
        onFocus={(e) => e.currentTarget.select()}
        className={`${inputClass} bg-bg font-mono font-bold ${invalid ? "border-accent-text" : ""}`}
      />
    </label>
  );
}

/** Parses "HH:MM" (24-hour); null if not a valid time. */
export function parseTime24(value: string): { h: number; m: number } | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? { h, m: min } : null;
}
