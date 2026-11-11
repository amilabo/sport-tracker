import { formatRest } from "@/domain/rest";
import { isBreakRest, overText, type RestSummary } from "@/domain/rest-summary";

/**
 * Rest before a set, between the set squares (stages 35, 49, mockup О8б): a short line under the squares, the text
 * beside it — no lines across, so the sets read as one column. «≈» — ticked without «Начать подход»; over the plan by
 * 30 s+ — accent; a break (2:00+ over) — «· перерыв», plain: it is not counted, nothing to look into.
 * `before` — before the first set: rest between exercises (stage 38). The rail sits under a 44 px square.
 */
export function RestLine({ sec, target, approx, before, className = "" }: { sec: number; target: number | undefined; approx: boolean; before?: boolean; className?: string }) {
  const brk = isBreakRest(sec, target);
  const long = !brk && target !== undefined && sec > target + 30;
  return (
    <div className={`flex min-h-6 items-stretch gap-2 ${className}`}>
      <span aria-hidden="true" className="flex w-11 shrink-0 justify-center">
        <span className="border-l-2 border-line-strong" />
      </span>
      <span className={`self-center font-mono text-xs ${long ? "font-bold text-accent-text" : "text-ink-muted"}`}>
        {before ? "отдых перед упражнением " : "отдых "}
        {approx ? "≈" : ""}
        {formatRest(sec)}
        {long && target !== undefined ? ` · план ${formatRest(target)}` : ""}
        {brk ? " · перерыв" : ""}
      </span>
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
        {rest.breakCount > 0
          ? ` Перерывы — отдых дольше плана на 2 минуты и больше — в среднее не входят (${rest.breakCount} ${rest.breakCount === 1 ? "раз" : rest.breakCount < 5 ? "раза" : "раз"}).`
          : ""}
        {rest.approxCount > 0
          ? ` «≈» — подход отметили без «Начать подход», в отдых вошёл сам подход (${rest.approxCount} ${rest.approxCount === 1 ? "раз" : rest.approxCount < 5 ? "раза" : "раз"}).`
          : ""}
      </p>
    </div>
  );
}
