"use client";

interface Scale5Props {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

/** 1–5 rating: five big buttons, one tap (PRD §3.7). */
export function Scale5({ label, value, onChange }: Scale5Props) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={label}>
      <span className="w-[104px] shrink-0 text-[13px] text-ink-muted">{label}</span>
      <div className="grid flex-1 grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${label}: ${n} из 5`}
              onClick={() => onChange(n)}
              className={`h-12 rounded-[10px] border-[1.5px] border-ink font-mono text-[15px] font-bold transition-[transform,background-color] active:scale-95 ${
                on ? "bg-surface-inverse text-on-inverse" : ""
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
