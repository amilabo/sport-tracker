"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { settingsRepo } from "@/db/repos/settings";
import { GOAL_DEFAULT, GOAL_MAX, GOAL_MIN, goalWord, type WeekDay } from "@/domain/rhythm";

/** − 2 раза в неделю + on a dark plate: the one setting of «Ритм» (mockups 25, 26). */
export function GoalPicker({ value, onChange, size = "md" }: { value: number; onChange: (n: number) => void; size?: "md" | "lg" }) {
  const big = size === "lg";
  const step = `flex shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-line-inverse font-semibold disabled:opacity-30 ${
    big ? "h-13 w-13 text-[26px]" : "h-12 w-12 text-2xl"
  }`;
  return (
    <div className={`flex items-center gap-3 rounded-[18px] bg-surface-inverse text-on-inverse ${big ? "p-3.5" : "p-3"}`}>
      <button type="button" aria-label="Меньше" onClick={() => onChange(value - 1)} disabled={value <= GOAL_MIN} className={step}>
        −
      </button>
      <span aria-live="polite" className="flex flex-1 flex-col items-center gap-0.5">
        <span className={`font-display leading-none font-extrabold text-accent-on-inverse ${big ? "text-[40px]" : "text-[34px]"}`}>{value}</span>
        <span className="text-sm text-on-inverse-muted">{goalWord(value)} в неделю</span>
      </span>
      <button type="button" aria-label="Больше" onClick={() => onChange(value + 1)} disabled={value >= GOAL_MAX} className={step}>
        +
      </button>
    </div>
  );
}

/** Home, goal not asked yet (mockup 26): pick the goal or «Не сейчас» — after that the home shows nothing of «Ритм». */
export function GoalCard() {
  const [goal, setGoal] = useState(GOAL_DEFAULT);
  return (
    <section aria-labelledby="goal-title" className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-3.5">
      <h2 id="goal-title" className="font-display text-[15px] leading-snug font-bold">
        Сколько раз в неделю хотите тренироваться?
      </h2>
      <GoalPicker value={goal} onChange={setGoal} />
      <div className="flex items-center gap-3">
        <Button variant="accent" className="flex-1" onClick={() => settingsRepo.update({ weekly_goal: goal })}>
          Сохранить
        </Button>
        <button
          type="button"
          onClick={() => settingsRepo.update({ weekly_goal: null })}
          className="min-h-11 shrink-0 px-2 text-sm font-semibold text-ink-muted underline underline-offset-[3px]"
        >
          Не сейчас
        </button>
      </div>
    </section>
  );
}

/**
 * Home header with a goal (mockup 24А): «1 из 2» and the week's seven days take the date line's place;
 * today is the ringed day. The whole row leads to «Ритм».
 */
export function WeekStrip({ days, count, goal, today }: { days: WeekDay[]; count: number; goal: number; today: string }) {
  const doneNames = days.filter((d) => d.done).map((d) => d.name);
  return (
    <Link
      href="/rhythm/"
      aria-label={`Ритм: ${count} из ${goal} на этой неделе${doneNames.length ? `, тренировки: ${doneNames.join(", ")}` : ""}. Сегодня ${today}. Подробнее`}
      className="flex min-h-11 items-center justify-between gap-2.5"
    >
      <span className="font-display text-[17px] leading-none font-extrabold whitespace-nowrap">
        {count} из {goal}
      </span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {days.map((d) => (
          <span
            key={d.key}
            className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-bold ${
              d.done ? "bg-accent text-on-accent" : d.past ? "text-ink-muted" : ""
            } ${d.today ? "border-2 border-ink" : d.done || d.past ? "" : "border-[1.5px] border-line"}`}
          >
            {d.letter}
          </span>
        ))}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
