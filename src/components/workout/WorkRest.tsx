import { formatRest } from "@/domain/rest";
import { overText, type RestSummary } from "@/domain/rest-summary";

/**
 * Rest before a set, drawn between set rows (stage 35): «отдых 2:05»; «≈» — ticked without «Начать подход»;
 * over the plan by 30 s+ — accent. `before` — before the first set: rest between exercises (stage 38).
 */
export function RestLine({ sec, target, approx, before, className = "" }: { sec: number; target: number | undefined; approx: boolean; before?: boolean; className?: string }) {
  const long = target !== undefined && sec > target + 30;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="h-0 flex-1 border-t-[1.5px] border-dashed border-line-strong" />
      <span className={`font-mono text-xs ${long ? "font-bold text-accent-text" : "text-ink-muted"}`}>
        {before ? "отдых перед упражнением " : "отдых "}
        {approx ? "≈" : ""}
        {formatRest(sec)}
        {long && target !== undefined ? ` · план ${formatRest(target)}` : ""}
      </span>
      <span aria-hidden="true" className="h-0 flex-1 border-t-[1.5px] border-dashed border-line-strong" />
    </div>
  );
}

/** «Работа и отдых» (mockup О7, stage 37): recorded rest, the rest of the time is work. On finish and in history. */
export function WorkRest({ rest, minutes }: { rest: RestSummary; minutes: number | null }) {
  const restMin = Math.round(rest.restSec / 60);
  // Times corrected by hand can make the rest longer than the workout: then work is unknown.
  const workMin = minutes !== null && minutes >= restMin ? minutes - restMin : null;
  const share = workMin !== null && minutes ? Math.round((restMin / minutes) * 100) : null;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-line bg-surface p-3.5">
      <span className="font-display text-xs font-bold tracking-[0.04em] uppercase">Работа и отдых</span>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
            Работа
          </span>
          <span className="font-display text-[22px] font-extrabold">{workMin === null ? "—" : `≈ ${workMin} мин`}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            Отдых · {rest.count} раз
          </span>
          <span className="font-display text-[22px] font-extrabold">{restMin} мин</span>
        </div>
      </div>
      {share !== null && (
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-done" aria-hidden="true">
          {/* Work is the bright part, rest the quiet one. */}
          <div className="h-full bg-accent" style={{ width: `${100 - share}%` }} />
          <div className="h-full bg-line-strong" style={{ width: `${share}%` }} />
        </div>
      )}
      <p className="text-[13px] leading-snug text-ink-muted">
        {rest.avgOverSec !== null ? `${overText(rest.avgOverSec)}.` : ""}
        {rest.longCount > 0 ? ` Дольше плана больше чем на 30 с — ${rest.longCount} ${rest.longCount === 1 ? "раз" : rest.longCount < 5 ? "раза" : "раз"}.` : ""}
        {rest.approxCount > 0
          ? ` «≈» — подход отметили без «Начать подход», в отдых вошёл сам подход (${rest.approxCount} ${rest.approxCount === 1 ? "раз" : rest.approxCount < 5 ? "раза" : "раз"}).`
          : ""}
      </p>
    </div>
  );
}
