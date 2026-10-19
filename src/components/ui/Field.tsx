import { forwardRef } from "react";

export const inputClass =
  "h-12 w-full rounded-xl border-[1.5px] border-ink bg-surface-raised px-3 text-base text-ink placeholder:text-ink-faint";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

/** Labelled text input. Font size 16px keeps iOS from zooming in on focus. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, className = "", ...rest }, ref) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
      {label}
      <input ref={ref} className={`${inputClass} ${className}`} {...rest} />
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
});

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className = "", ...rest } = props;
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted">
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
      <input type="search" enterKeyHint="search" autoComplete="off" className={`${inputClass} pl-10 ${className}`} {...rest} />
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-danger">
      {message}
    </p>
  );
}
