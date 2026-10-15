import { BackButton } from "./BackButton";

interface PageHeaderProps {
  title: string;
  eyebrow?: React.ReactNode;
  backHref?: string;
  action?: React.ReactNode;
}

/** Big display title from the mockups; with backHref it becomes a sub-page header. */
export function PageHeader({ title, eyebrow, backHref, action }: PageHeaderProps) {
  if (backHref) {
    return (
      <header className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <BackButton fallback={backHref} />
        <h1 className="min-w-0 flex-1 font-display text-[15px] font-bold uppercase tracking-[0.02em]">
          {title}
        </h1>
        {action}
      </header>
    );
  }

  return (
    <header className="flex items-end justify-between gap-3 px-5 pt-7">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <div className="font-mono text-[13px] uppercase tracking-[0.08em] text-ink-muted">{eyebrow}</div>
        )}
        <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">{title}</h1>
      </div>
      {action}
    </header>
  );
}
