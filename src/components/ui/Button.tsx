import Link from "next/link";

type Variant = "primary" | "accent" | "outline" | "ghost" | "quiet";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-surface-inverse text-on-inverse font-bold",
  accent: "bg-accent text-on-accent font-bold",
  outline: "border-[1.5px] border-ink text-ink font-semibold",
  ghost: "border-[1.5px] border-dashed border-ink text-ink font-semibold",
  quiet: "border-[1.5px] border-line text-ink-muted font-semibold",
};

const SIZES: Record<Size, string> = {
  md: "min-h-11 rounded-xl px-4 text-sm",
  lg: "min-h-13 rounded-[14px] px-4 text-[15px]",
  xl: "min-h-16 rounded-2xl px-5 font-display text-[17px]",
};

export function buttonClass(variant: Variant = "outline", size: Size = "lg", extra = "") {
  return `inline-flex items-center justify-center gap-2 text-center transition-[transform,opacity] active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className = "", ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
