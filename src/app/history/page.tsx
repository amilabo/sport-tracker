"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { workoutsRepo } from "@/db/repos/workouts";
import { formatTime, plural } from "@/domain/format";
import { filterKey, groupByMonth, moodLine, NO_PLAN, type HistoryEntry } from "@/domain/history";
import { durationMinutes, formatDurationLong, formatKg } from "@/domain/summary";

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function Row({ entry }: { entry: HistoryEntry }) {
  const { workout, summary } = entry;
  const d = new Date(workout.started_at);
  const minutes = workout.finished_at ? durationMinutes(workout.started_at, workout.finished_at) : null;
  const mood = moodLine(workout.mood_before, workout.mood_after);
  const stats = [`выполнено ${summary.percent}%`, summary.volumeKg > 0 ? `${formatKg(summary.volumeKg)} кг` : null].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/history/view/?id=${workout.id}`}
      className="flex items-center gap-3.5 rounded-2xl border-[1.5px] border-line bg-surface px-3.5 py-3"
    >
      <span className="flex w-11 shrink-0 flex-col items-center leading-none">
        <span className="font-display text-[22px] font-extrabold">{d.getDate()}</span>
        <span className="mt-1 text-[11px] text-ink-muted">{WEEKDAYS[d.getDay()]}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] leading-tight font-semibold">{entry.planName ?? "Без плана"}</span>
        <span className="font-mono text-xs">
          начало {formatTime(d)}
          {minutes !== null && ` · ${formatDurationLong(minutes)}`}
        </span>
        <span className="font-mono text-xs text-ink-muted">{stats}</span>
        {workout.status === "auto_finished" && <span className="text-xs text-accent-text">завершена автоматически</span>}
      </span>
      {mood && (
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[11px] text-ink-muted">настроение</span>
          <span className="font-mono text-sm font-bold">{mood}</span>
        </span>
      )}
    </Link>
  );
}

/** «История» (PRD §3.8): finished workouts by month, filter by plan. */
export default function HistoryPage() {
  const { data: entries } = useLive(() => workoutsRepo.listHistory(), [], ["workouts", "workout_exercises", "workout_sets", "plans", "exercises"]);
  const [filter, setFilter] = useState<string>("all");

  const options: { id: string; label: string }[] = [{ id: "all", label: "Все" }];
  for (const e of [...(entries ?? [])].sort((a, b) => b.workout.started_at.localeCompare(a.workout.started_at))) {
    const id = filterKey(e.workout);
    if (!options.some((o) => o.id === id)) options.push({ id, label: e.planName ?? "Без плана" });
  }
  // «Без плана» goes last.
  options.sort((a, b) => Number(a.id === NO_PLAN) - Number(b.id === NO_PLAN));
  const active = options.some((o) => o.id === filter) ? filter : "all";
  const months = groupByMonth((entries ?? []).filter((e) => active === "all" || filterKey(e.workout) === active));

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <PageHeader title="История" />

      {entries && entries.length === 0 && (
        <section className="mx-4 flex flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4">
          <span className="text-[15px] font-semibold">Пока пусто</span>
          <span className="text-[13px] leading-snug text-ink-muted">
            Здесь появятся завершённые тренировки. Перенесли историю из файла копии? Это делается в «Ещё → Копия данных».
          </span>
          <ButtonLink href="/" variant="primary" className="w-full">
            К тренировкам
          </ButtonLink>
        </section>
      )}

      {options.length > 2 && (
        <div role="radiogroup" aria-label="План" className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
          {options.map((o) => {
            const on = o.id === active;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFilter(o.id)}
                className={`h-10 shrink-0 rounded-full border-[1.5px] border-ink px-3.5 text-[13px] font-semibold whitespace-nowrap ${
                  on ? "bg-surface-inverse text-on-inverse" : ""
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {months.map((m) => (
        <section key={m.key} className="flex flex-col gap-2 px-4">
          <h2 className="flex justify-between px-1 font-mono text-xs tracking-[0.08em] text-ink-muted uppercase">
            <span>{m.title}</span>
            <span>
              {m.entries.length} {plural(m.entries.length, ["тренировка", "тренировки", "тренировок"])}
            </span>
          </h2>
          {m.entries.map((e) => (
            <Row key={e.workout.id} entry={e} />
          ))}
        </section>
      ))}
    </div>
  );
}
