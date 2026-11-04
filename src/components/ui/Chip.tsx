interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  on: boolean;
  onClick: () => void;
}

/** Toggle chip used for filters and single choice. */
export function Chip({ on, onClick, className = "", children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 rounded-[10px] border-[1.5px] px-3 text-sm font-semibold transition-colors ${
        on ? "border-selected bg-selected text-on-selected" : "border-line bg-surface text-ink"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
