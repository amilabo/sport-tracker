"use client";

import Link from "next/link";
import { useState } from "react";
import { monthCardLine, monthParam } from "@/components/rhythm/MonthSummaryView";
import { GoalPicker } from "@/components/rhythm/Rhythm";
import { WeekLoad } from "@/components/rhythm/WeekLoad";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { workoutsRepo } from "@/db/repos/workouts";
import { monthSummary } from "@/domain/analytics/month-summary";
import { plural } from "@/domain/format";
import { doneByDay, GOAL_DEFAULT, habitDays, monthGrid, MONTHS, monthWeeks, weeksInRhythm, weekWorkouts } from "@/domain/rhythm";
import { formatKg } from "@/domain/summary";

const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";
const WORKOUT_FORMS: [string, string, string] = ["тренировка", "тренировки", "тренировок"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * «Ритм» (stage 32, mockup 25): the goal, the month as a calendar, weeks as a list, when you usually go.
 * Everything but the goal is counted from logged workouts.
 */
export default function RhythmPage() {
  const { data } = useLive(
    async () => {
      const [settings, { workouts: completed, items }, history] = await Promise.all([settingsRepo.get(), workoutsRepo.completedItems(), workoutsRepo.listHistory()]);
      return { goal: settings.weekly_goal, done: doneByDay(completed), completed, items, history };
    },
    [],
    ["settings", "workouts", "workout_exercises", "workout_sets", "exercises", "plans"],
  );
  const [draft, setDraft] = useState(GOAL_DEFAULT);
  // Months back from the current one, for the calendar arrows.
  const [back, setBack] = useState(0);
  // The week opened in «Недели <месяца>» (one at a time).
  const [openWeek, setOpenWeek] = useState<string | null>(null);

  if (!data) return <PageHeader title="Ритм" backHref="/" />;
  const now = new Date();
  const goal = typeof data.goal === "number" ? data.goal : null;
  const shownMonth = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const month = monthGrid(shownMonth.getFullYear(), shownMonth.getMonth(), data.done, now);
  const weeks = monthWeeks(shownMonth.getFullYear(), shownMonth.getMonth(), data.done, now);
  const rhythm = goal ? weeksInRhythm(weeks, goal) : null;
  const habit = habitDays(data.done, now);
  const habitMax = Math.max(...habit.map((h) => h.count));
  // «Аналитика» (stage 45): the card into «Итоги» of the month on screen — only when it had workouts.
  const summary = month.count > 0 ? monthSummary(shownMonth.getFullYear(), shownMonth.getMonth(), data.completed, data.items, goal, now) : null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-8">
      <div className="-mx-4">
        <PageHeader title="Ритм" backHref="/" />
      </div>

      <section aria-labelledby="goal-h" className="flex flex-col gap-2.5">
        <h2 id="goal-h" className={sectionTitle}>
          Цель
        </h2>
        <GoalPicker value={goal ?? draft} onChange={(n) => (goal ? settingsRepo.update({ weekly_goal: n }) : setDraft(n))} size="lg" />
        {goal ? (
          <button
            type="button"
            onClick={() => settingsRepo.update({ weekly_goal: null })}
            className="min-h-11 self-start text-sm font-semibold text-ink-muted underline underline-offset-[3px]"
          >
            Убрать цель
          </button>
        ) : (
          <Button variant="accent" onClick={() => settingsRepo.update({ weekly_goal: draft })}>
            Сохранить цель
          </Button>
        )}
      </section>

      <section aria-labelledby="month-h" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="month-h" className={sectionTitle}>
            {MONTHS[shownMonth.getMonth()]}
            {shownMonth.getFullYear() !== now.getFullYear() && ` ${shownMonth.getFullYear()}`}
          </h2>
          <span className="flex items-center gap-1">
            <span className="mr-1 text-sm text-ink-muted">
              <b className="text-ink">{month.count}</b> {plural(month.count, WORKOUT_FORMS)}
            </span>
            <button type="button" onClick={() => setBack(back + 1)} aria-label="Предыдущий месяц" className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line">
              <Arrow dir="left" />
            </button>
            <button
              type="button"
              onClick={() => setBack(back - 1)}
              disabled={back === 0}
              aria-label="Следующий месяц"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line disabled:opacity-30"
            >
              <Arrow dir="right" />
            </button>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-line bg-surface px-2.5 py-3">
          <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs font-semibold text-ink-muted">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ul className="grid grid-cols-7 gap-y-1">
            {month.cells.map((c, i) => (
              <li key={c?.key ?? `pad-${i}`} className="flex justify-center">
                {c && (
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-[13px] font-bold ${
                      c.done ? "bg-accent text-on-accent" : c.future ? "text-ink-muted" : ""
                    } ${c.today ? "border-2 border-ink" : ""}`}
                  >
                    {c.day}
                    <span className="sr-only">
                      {c.done ? ", тренировка" : ""}
                      {c.today ? ", сегодня" : ""}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="weeks-h" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="weeks-h" className={sectionTitle}>
            Недели {MONTHS_GEN[shownMonth.getMonth()]}
          </h2>
          {rhythm && rhythm.total > 0 && (
            <span className="text-sm text-ink-muted">
              {rhythm.full} из {rhythm.total} в ритме
            </span>
          )}
        </div>
        <ul className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
          {weeks.map((w) => {
            const dots = Math.max(goal ?? 0, w.count);
            const open = openWeek === w.key;
            const week = open ? weekWorkouts(w.key, data.history) : null;
            return (
              <li key={w.key} className="border-t border-line first:border-t-0">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`week-${w.key}`}
                  onClick={() => setOpenWeek(open ? null : w.key)}
                  className="flex min-h-[72px] w-full items-center gap-2.5 py-3 pr-3 pl-4 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-bold">{w.range}</span>
                    <span className="text-sm text-ink-muted">{w.days}</span>
                  </span>
                  <span role="img" className="flex flex-wrap justify-end gap-[5px]" aria-label={goal ? `${w.count} из ${goal}` : `${w.count} ${plural(w.count, WORKOUT_FORMS)}`}>
                    {Array.from({ length: dots }, (_, j) => (
                      <span key={j} className={`h-4 w-4 rounded-full ${j < w.count ? "bg-accent" : "border-2 border-line-strong"}`} />
                    ))}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {week && (
                  <div id={`week-${w.key}`} className="flex flex-col gap-1.5 px-4 pb-3.5">
                    {week.items.map((it) => (
                      <Link key={it.id} href={`/history/view/?id=${it.id}`} className="flex min-h-12 items-center gap-2.5 rounded-xl bg-bg px-3">
                        <span className="w-16 shrink-0 font-mono text-[13px] font-bold">{it.day}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.plan}</span>
                        {it.duration && <span className="shrink-0 font-mono text-[13px] text-ink-muted">{it.duration}</span>}
                      </Link>
                    ))}
                    <span className="pt-0.5 text-[13px] text-ink-muted">
                      {week.items.length
                        ? `${week.sets} ${plural(week.sets, ["подход", "подхода", "подходов"])}${week.volume ? ` · ${formatKg(week.volume)} кг` : ""}`
                        : "Пока без тренировок"}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {habitMax > 0 && (
        <section aria-labelledby="habit-h" className="flex flex-col gap-2.5">
          <h2 id="habit-h" className={sectionTitle}>
            Когда вы обычно ходите
          </h2>
          <ul className="grid h-[132px] grid-cols-7 items-end gap-1.5 rounded-[18px] border-[1.5px] border-line bg-surface px-2.5 pt-3">
            {habit.map((h) => (
              <li key={h.name} className="flex h-full flex-col items-center justify-end gap-1.5">
                <span
                  className={`w-[22px] rounded-t-md ${h.top ? "bg-accent" : "bg-line"}`}
                  style={{ height: `${Math.max(4, Math.round((h.count / habitMax) * 76))}px` }}
                />
                <span className={`pb-2 text-[13px] font-semibold ${h.top ? "" : "text-ink-muted"}`}>{h.name}</span>
                <span className="sr-only">: {h.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeekLoad items={data.items} now={now} />

      {summary && (
        <section aria-labelledby="analytics-h" className="flex flex-col gap-2.5">
          <h2 id="analytics-h" className={sectionTitle}>
            Аналитика
          </h2>
          <Link
            href={`/rhythm/month/?m=${monthParam(shownMonth.getFullYear(), shownMonth.getMonth())}`}
            className="flex min-h-14 items-center gap-3 rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-bold">Итоги {MONTHS_GEN[shownMonth.getMonth()]}</span>
              {monthCardLine(summary) && <span className="text-[13px] text-ink-muted">{monthCardLine(summary)}</span>}
            </span>
            <Arrow dir="right" />
          </Link>
        </section>
      )}
    </div>
  );
}
