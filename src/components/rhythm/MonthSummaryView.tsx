"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { workoutsRepo } from "@/db/repos/workouts";
import { monthSummary } from "@/domain/analytics/month-summary";
import { recordsWord } from "@/domain/analytics/records";
import { formatNumber, plural } from "@/domain/format";
import { MONTHS } from "@/domain/rhythm";
import { formatKg } from "@/domain/summary";

const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";
const MONTHS_LOWER = MONTHS.map((m) => m.toLowerCase());

/** «2026-10» → [2026, 9]; anything else — the current month. */
export function parseMonth(m: string | null, now: Date): [number, number] {
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]), mo = Number(match[2]) - 1;
    if (mo >= 0 && mo < 12 && new Date(y, mo, 1) <= now) return [y, mo];
  }
  return [now.getFullYear(), now.getMonth()];
}

export const monthParam = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** «до 3,1», «после 4,3» as two bars out of 5 (or 100 %). */
function Bars({ rows, max, label }: { rows: { name: string; value: number; text: string; strong: boolean }[]; max: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2.5">
          <span className="w-14 shrink-0 text-[13px] text-ink-muted">{r.name}</span>
          <span className="flex h-3.5 flex-1 rounded bg-surface-done">
            <span className={`rounded ${r.strong ? "bg-accent" : "bg-line-strong"}`} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-sm font-bold">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** /rhythm/month/?m=2026-10 — «Итоги месяца» (stage 45, mockup А6), opened from «Ритм». */
export function MonthSummaryView() {
  const params = useSearchParams();
  const router = useRouter();
  const now = new Date();
  const [year, month] = parseMonth(params.get("m"), now);
  const { data } = useLive(
    async () => {
      const [{ workouts, items }, settings] = await Promise.all([workoutsRepo.completedItems(), settingsRepo.get()]);
      return { workouts, items, goal: typeof settings.weekly_goal === "number" ? settings.weekly_goal : null };
    },
    [],
    ["workouts", "workout_exercises", "workout_sets", "exercises", "settings"],
  );

  const go = (dy: number) => {
    const d = new Date(year, month + dy, 1);
    router.replace(`/rhythm/month/?m=${monthParam(d.getFullYear(), d.getMonth())}`);
  };
  const first = data?.workouts.reduce<Date | null>((acc, w) => {
    const d = new Date(w.started_at);
    return !acc || d < acc ? d : acc;
  }, null);
  const canBack = !!first && new Date(year, month, 1) > new Date(first.getFullYear(), first.getMonth(), 1);
  const canForward = new Date(year, month + 1, 1) <= now;
  const s = data && monthSummary(year, month, data.workouts, data.items, data.goal, now);
  const prevName = MONTHS_LOWER[(month + 11) % 12];

  return (
    <div className="flex flex-1 flex-col gap-3.5 px-4 pb-8">
      <header className="flex items-center gap-2.5 pt-5">
        <BackButton fallback="/rhythm/" label="Назад к ритму" />
        <h1 className="min-w-0 flex-1 font-display text-[15px] font-bold tracking-[0.02em] uppercase">Итоги</h1>
        <button type="button" onClick={() => go(-1)} disabled={!canBack} aria-label="Прошлый месяц" className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line disabled:opacity-30">
          <Arrow dir="left" />
        </button>
        <button type="button" onClick={() => go(1)} disabled={!canForward} aria-label="Следующий месяц" className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line disabled:opacity-30">
          <Arrow dir="right" />
        </button>
      </header>

      <h2 className="font-display text-[32px] leading-none font-extrabold">
        {MONTHS[month]}
        {year !== now.getFullYear() && ` ${year}`}
      </h2>

      {s && s.workouts === 0 && <p className="text-[15px] text-ink-muted">В этом месяце тренировок не было.</p>}

      {s && s.workouts > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-[18px] bg-surface-inverse px-4 py-3.5 text-on-inverse">
              <span className="text-[13px] text-on-inverse-muted">Тренировок</span>
              <span className="font-display text-4xl leading-none font-extrabold text-accent-on-inverse">{s.workouts}</span>
              {s.rhythm && s.rhythm.total > 0 && (
                <span className="text-[13px] text-on-inverse-muted">
                  {s.rhythm.full} из {s.rhythm.total} {plural(s.rhythm.total, ["недели", "недель", "недель"])} в ритме
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
              <span className="text-[13px] text-ink-muted">Рекордов</span>
              <span className="font-display text-4xl leading-none font-extrabold">{s.records}</span>
              {s.records > 0 && (
                <span className="text-[13px] text-ink-muted">
                  в {s.recordExercises} {plural(s.recordExercises, ["упражнении", "упражнениях", "упражнениях"])}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
              <span className="text-[13px] text-ink-muted">Подходов</span>
              <span className="font-display text-[28px] leading-none font-extrabold">{s.sets}</span>
              <span className="text-[13px] text-ink-muted">
                {prevName} — {s.prevSets}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
              <span className="text-[13px] text-ink-muted">Объём, кг</span>
              <span className="font-display text-[28px] leading-none font-extrabold">{formatKg(s.volume)}</span>
              <span className="text-[13px] text-ink-muted">
                {prevName} — {formatKg(s.prevVolume)}
              </span>
            </div>
          </div>

          {(s.growth.length > 0 || s.stalled.length > 0) && (
            <section aria-labelledby="growth-h" className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface px-4 pt-3.5 pb-1">
              <h2 id="growth-h" className={`${sectionTitle} mb-1.5`}>
                Рост за месяц · ≈ максимум
              </h2>
              <ul>
                {s.growth.map((g) => (
                  <li key={g.name} className="flex min-h-11 items-center gap-2 border-t border-line py-1.5">
                    <span className="flex-1 text-[15px]">{g.name}</span>
                    <span className="font-mono text-sm font-bold">+{formatNumber(g.delta, 2)} кг</span>
                  </li>
                ))}
                {s.stalled.map((name) => (
                  <li key={name} className="flex min-h-11 items-center gap-2 border-t border-line py-1.5">
                    <span className="flex-1 text-[15px]">{name}</span>
                    <span className="text-[13px] text-accent-text">на одном уровне</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.mood && (
            <section aria-labelledby="mood-h" className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
              <h2 id="mood-h" className={sectionTitle}>
                Настроение
              </h2>
              <p className="text-[15px] leading-[1.4]">{moodText(s.mood.after - s.mood.before)}</p>
              <Bars
                max={5}
                label={`Настроение до тренировки ${formatNumber(s.mood.before)} из 5, после ${formatNumber(s.mood.after)} из 5`}
                rows={[
                  { name: "до", value: s.mood.before, text: formatNumber(s.mood.before), strong: false },
                  { name: "после", value: s.mood.after, text: formatNumber(s.mood.after), strong: true },
                ]}
              />
              <span className="text-xs text-ink-muted">
                по {s.mood.count} {plural(s.mood.count, ["тренировке", "тренировкам", "тренировкам"])}, где отмечено и до, и после
              </span>
            </section>
          )}

          {s.feel && (
            <section aria-labelledby="feel-h" className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5">
              <h2 id="feel-h" className={sectionTitle}>
                Самочувствие и результат
              </h2>
              <p className="text-[15px] leading-[1.4]">{feelText(s.feel.high - s.feel.low)}</p>
              <Bars
                max={100}
                label={`Подходов по плану: при самочувствии 4–5 — ${s.feel.high} процентов, при 1–3 — ${s.feel.low} процентов`}
                rows={[
                  { name: "4–5", value: s.feel.high, text: `${s.feel.high}%`, strong: s.feel.high >= s.feel.low },
                  { name: "1–3", value: s.feel.low, text: `${s.feel.low}%`, strong: s.feel.low > s.feel.high },
                ]}
              />
              <span className="text-xs text-ink-muted">
                за всё время: {s.feel.highCount} и {s.feel.lowCount} {plural(s.feel.lowCount, ["тренировка", "тренировки", "тренировок"])}. Меньше 8 в группе — не показываем.
              </span>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function moodText(diff: number): string {
  const d = formatNumber(Math.abs(diff));
  if (Math.abs(diff) < 0.05) return "После тренировки в среднем такое же, как до неё";
  return `После тренировки в среднем на ${d} ${diff > 0 ? "выше" : "ниже"}, чем до неё`;
}

function feelText(diff: number): string {
  if (diff === 0) return "Самочувствие до тренировки на долю подходов по плану не влияет";
  return `Когда самочувствие 4–5, вы делаете ${diff > 0 ? "больше" : "меньше"} подходов по плану`;
}

/** «7 рекордов · настроение после тренировки +1,2» under «Итоги октября» in «Ритм»; parts without data are left out. */
export function monthCardLine(s: { records: number; mood: { before: number; after: number } | null }): string {
  const parts: string[] = [];
  if (s.records > 0) parts.push(`${s.records} ${recordsWord(s.records)}`);
  if (s.mood) {
    const d = s.mood.after - s.mood.before;
    parts.push(`настроение после тренировки ${d >= 0 ? "+" : "−"}${formatNumber(Math.abs(d))}`);
  }
  return parts.join(" · ");
}
