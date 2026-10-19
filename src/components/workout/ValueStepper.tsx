"use client";

import { useEffect, useRef, useState } from "react";

interface ValueStepperProps {
  display: string;
  unit: string;
  changed: boolean;
  onStep: (dir: 1 | -1) => void;
  /** Parses typed text; returns false if it is not a valid value. */
  onType: (text: string) => boolean;
  inputMode?: "decimal" | "numeric";
}

const COMMIT_DELAY = 1000;

/** − value + with big targets. Tapping the value switches to keyboard input (saved 1 s after typing stops, PRD §3.3). */
export function ValueStepper({ display, unit, changed, onStep, onType, inputMode = "decimal" }: ValueStepperProps) {
  const [text, setText] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function commit(value: string) {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim() === "") return;
    setInvalid(!onType(value));
  }

  const border = invalid ? "border-danger" : changed ? "border-accent-line" : "border-line";

  return (
    <div className={`flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-xl border-[1.5px] ${border}`}>
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label={`Уменьшить: ${unit}`}
        className="flex h-full w-11 shrink-0 items-center justify-center text-xl font-semibold active:bg-surface-done"
      >
        −
      </button>
      {text === null ? (
        <button
          type="button"
          onClick={() => setText(display)}
          aria-label={`${display} ${unit}, ввести вручную`}
          className="flex min-w-0 flex-1 flex-col items-center justify-center leading-none"
        >
          <span className={`font-mono text-base font-bold ${changed ? "text-accent-text" : ""}`}>{display}</span>
          <span className="mt-0.5 text-[11px] text-ink-muted">{unit}</span>
        </button>
      ) : (
        <input
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          value={text}
          inputMode={inputMode}
          enterKeyHint="done"
          aria-label={unit}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(v), COMMIT_DELAY);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={(e) => {
            commit(e.currentTarget.value);
            setText(null);
          }}
          className="h-full w-full min-w-0 flex-1 bg-surface-raised text-center font-mono text-base font-bold outline-none"
        />
      )}
      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label={`Увеличить: ${unit}`}
        className="flex h-full w-11 shrink-0 items-center justify-center text-xl font-semibold active:bg-surface-done"
      >
        +
      </button>
    </div>
  );
}
