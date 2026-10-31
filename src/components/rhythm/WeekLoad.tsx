"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { upperFirst } from "@/content/technique";
import type { AnalyticsItem } from "@/domain/analytics/month-summary";
import { WEEKLY_SETS_HINT } from "@/domain/analytics/thresholds";
import { defaultLoadWeek, weekLoad, weeksBefore } from "@/domain/analytics/week-load";
import { formatNumber, plural } from "@/domain/format";
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_ON } from "@/domain/labels";
import { weekStart } from "@/domain/rhythm";
import { formatKg } from "@/domain/summary";
import type { MuscleGroup } from "@/domain/types";

const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
/** «у груди», «у спины». */
const OF_GROUP: Partial<Record<MuscleGroup, string>> = { chest: "груди", back: "спины", legs: "ног", glutes: "ягодиц", shoulders: "плеч", arms: "рук", abs: "пресса" };
const SETS: [string, string, string] = ["подход", "подхода", "подходов"];

function range(start: Date): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

const sets = (n: number) => formatNumber(n);

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

function lagText(s: number, pair: MuscleGroup, p: number): string {
  const where = `у ${OF_GROUP[pair]} (${sets(p)})`;
  if (s === 0) return `Ни одного подхода за неделю, а ${where} — уже 3 недели подряд.`;
  const r = p / s;
  const times = r < 4 ? "втрое" : `в ${Math.floor(r)} раз`;
  return `${sets(s)} ${Number.isInteger(s) ? plural(s, SETS) : "подхода"} в неделю — ${times} меньше, чем ${where}, уже 3 недели подряд.`;
}

/**
 * «Нагрузка недели» (stage 42б, mockup А3): sets per muscle group with the «обычно» mark, «… отстаёт» and
 * «Нагрузка резко выросла». Its own ‹ › by weeks, separate from the month above.
 */
export function WeekLoad({ items, now }: { items: AnalyticsItem[]; now: Date }) {
  const current = weekStart(now);
  const [shown, setShown] = useState(() => defaultLoadWeek(items, current));
  const first = items.reduce((min, it) => Math.min(min, new Date(it.startedAt).getTime()), Infinity);
  if (!Number.isFinite(first)) return null;
  const canBack = weeksBefore(shown, 1).getTime() >= weekStart(new Date(first)).getTime();
  const canForward = shown.getTime() < current.getTime();
  const load = weekLoad(items, shown);
  const max = Math.max(1, ...load.bars.map((b) => Math.max(b.sets, b.usual ?? 0)));
  const hasUsual = load.bars.some((b) => b.usual !== null);

  return (
    <section aria-labelledby="load-h" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="load-h" className={sectionTitle}>
          Нагрузка недели
        </h2>
        <span className="flex items-center gap-1.5">
          <button type="button" onClick={() => setShown(weeksBefore(shown, 1))} disabled={!canBack} aria-label="Прошлая неделя" className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line disabled:opacity-30">
            <Arrow dir="left" />
          </button>
          <span className="min-w-[84px] text-center text-sm font-semibold">{range(shown)}</span>
          <button type="button" onClick={() => setShown(weeksBefore(shown, -1))} disabled={!canForward} aria-label="Следующая неделя" className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line disabled:opacity-30">
            <Arrow dir="right" />
          </button>
        </span>
      </div>

      <div aria-label="Подходы по группам мышц" role="group" className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
        <dl className="grid grid-cols-3 gap-2">
          {[
            ["Тренировок", String(load.workouts)],
            ["Подходов", String(load.sets)],
            ["Объём, кг", formatKg(load.volume)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="font-mono text-lg font-bold">{v}</dd>
            </div>
          ))}
        </dl>

        {load.bars.length > 0 ? (
          <>
            {hasUsual && (
              <div aria-hidden="true" className="flex items-center gap-3.5 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3.5 rounded-[3px] bg-accent" />
                  эта неделя
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-[3px] bg-ink" />
                  обычно, за 4 недели
                </span>
              </div>
            )}
            <div
              role="img"
              aria-label={`Подходов за неделю: ${load.bars.map((b) => `${MUSCLE_GROUP_LABELS[b.group]} ${sets(b.sets)}${b.usual !== null ? `, обычно ${sets(Math.round(b.usual * 2) / 2)}` : ""}`).join("; ")}`}
              className="flex flex-col gap-2.5"
            >
              {load.bars.map((b) => (
                <div key={b.group} className="flex items-center gap-2.5">
                  <span className={`w-[74px] shrink-0 text-sm ${load.lag?.group === b.group ? "font-bold" : ""}`}>{upperFirst(MUSCLE_GROUP_LABELS[b.group])}</span>
                  <span className="relative h-3.5 flex-1 rounded bg-surface-done">
                    <span className="absolute inset-y-0 left-0 rounded bg-accent" style={{ width: `${(b.sets / max) * 100}%` }} />
                    {b.usual !== null && b.usual > 0 && <span className="absolute -top-1 h-[22px] w-[3px] bg-ink" style={{ left: `calc(${(b.usual / max) * 100}% - 1.5px)` }} />}
                  </span>
                  <span className="w-9 shrink-0 text-right font-mono text-sm font-bold">{sets(b.sets)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">В эту неделю подходов по группам мышц нет.</p>
        )}
        <p className="text-xs leading-[1.45] text-ink-muted">
          Для роста мышц обычно делают от {WEEKLY_SETS_HINT} подходов на группу в неделю. Основная группа упражнения получает 1 подход, вторичные — по 0,5: тяга нижнего блока — спине 1, рукам и плечам по 0,5.
        </p>
      </div>

      {load.lag && (
        <section aria-labelledby="lag-h" className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3.5">
          <h3 id="lag-h" className="text-base font-bold">
            {upperFirst(MUSCLE_GROUP_LABELS[load.lag.group])} {load.lag.group === "legs" || load.lag.group === "glutes" || load.lag.group === "shoulders" || load.lag.group === "arms" ? "отстают" : "отстаёт"}
          </h3>
          <p className="text-sm leading-[1.45] text-ink-muted">{lagText(load.lag.sets, load.lag.pair, load.lag.pairSets)}</p>
          <ButtonLink href={`/exercises/?group=${load.lag.group}`} variant="outline" size="md" className="w-full">
            Упражнения на {MUSCLE_GROUP_ON[load.lag.group]}
          </ButtonLink>
        </section>
      )}

      {load.spike && (
        <section aria-labelledby="spike-h" className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
          <h3 id="spike-h" className="text-base font-bold">
            Нагрузка резко выросла
          </h3>
          <p className="text-sm leading-[1.45] text-ink-muted">
            {load.spike.sets} {plural(load.spike.sets, SETS)} — в {formatNumber(load.spike.ratio)} раза больше обычного ({load.spike.usual}). Если восстанавливаться тяжело, следующую неделю сделайте полегче.
          </p>
        </section>
      )}
    </section>
  );
}
