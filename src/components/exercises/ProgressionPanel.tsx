"use client";

import Link from "next/link";
import { useState } from "react";
import { ProgressionChart } from "@/components/charts/ProgressionChart";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { progressionsRepo, type Chain } from "@/db/repos/progressions";
import { workoutsRepo } from "@/db/repos/workouts";
import { formatShortDate } from "@/domain/format";
import { chainSeries, chainTimeline, levelInfo, type ChainSeries, type LevelInfo } from "@/domain/progression";
import { formatSetsSummary } from "@/domain/sets";
import { DomainError, type Exercise } from "@/domain/types";

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};

const STATE_TEXT: Record<LevelInfo["state"], string> = { passed: "пройден", current: "сейчас", goal: "цель", none: "" };

function metaLine(l: LevelInfo): string {
  if (!l.firstAt) return "ещё не выполнялось";
  const dates = l.state === "current" || l.firstAt === l.lastAt ? `с ${dayMonth(l.firstAt)}` : `${dayMonth(l.firstAt)} — ${dayMonth(l.lastAt!)}`;
  return l.range ? `${dates} · ${l.range}` : dates;
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** А7: the whole chain on one chart — «Уровень 3 из 3 · с 14.10». Nothing done yet — no card. */
function ChainCard({ series }: { series: ChainSeries }) {
  if (series.from === null) return null;
  return (
    <section aria-label="Вся прогрессия на графике" className="flex flex-col gap-3 rounded-[20px] bg-surface-inverse p-4 text-on-inverse">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-on-inverse-muted">Вся прогрессия · с {MONTHS_GEN[new Date(series.from).getMonth()]}</span>
        {series.current && (
          <span className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-display text-[30px] leading-none font-extrabold text-accent-on-inverse">Уровень {series.current.level}</span>
            <span className="font-mono text-[13px] text-on-inverse-muted">
              из {series.levels.length} · с {shortDate(series.current.since)}
            </span>
          </span>
        )}
      </div>
      <ProgressionChart series={series} />
      <p className="text-xs leading-[1.45] text-on-inverse-muted">
        Внутри уровня выше — лучше: больше вес или раз, меньше помощи. Пунктир — переход на следующий вариант.
      </p>
    </section>
  );
}

/** «Вся прогрессия» (PRD §3.1.2): levels, then every variant's workouts with transition marks. */
export function ProgressionPanel({ chain, current }: { chain: Chain; current: Exercise }) {
  const ids = chain.members.map((m) => m.id);
  const { data: sessions } = useLive(() => workoutsRepo.exerciseSessions(ids), [ids.join(",")], ["workouts", "workout_exercises", "workout_sets"]);
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sessions) return null;
  const levels = levelInfo(chain.members, sessions);
  const timeline = chainTimeline(chain.members, sessions);
  const series = chainSeries(chain.members, sessions);
  const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось сохранить. Попробуйте ещё раз.");
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className={sectionTitle}>Прогрессия «{chain.progression.name}»</h2>
        <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 shrink-0 text-[13px] font-semibold text-accent-text">
          {editing ? "Готово" : "Настроить"}
        </button>
      </div>

      <ChainCard series={series} />

      <ol className="flex flex-col gap-2">
        {levels.map((l, i) => {
          const isCurrent = l.state === "current";
          return (
            <li
              key={l.exercise.id}
              className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 ${
                isCurrent ? "border-ink bg-surface-inverse text-on-inverse" : l.state === "goal" || l.state === "none" ? "border-line-strong" : "border-line bg-surface"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-bold ${
                  isCurrent ? "border-accent-line" : l.state === "passed" ? "border-ink" : "border-line-strong"
                }`}
              >
                {l.level}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {l.exercise.id === current.id ? (
                  <span className="text-[15px] leading-tight font-semibold">{l.exercise.name}</span>
                ) : (
                  <Link href={`/exercises/view/?id=${l.exercise.id}&tab=chain`} className="text-[15px] leading-tight font-semibold underline underline-offset-2">
                    {l.exercise.name}
                  </Link>
                )}
                <span className={`text-xs ${isCurrent ? "text-on-inverse-muted" : "text-ink-muted"}`}>
                  {metaLine(l)}
                  {l.exercise.archived_at ? " · в архиве" : ""}
                </span>
              </span>
              {editing ? (
                <span className="flex shrink-0 gap-1">
                  {/* The list goes from easy (top) to hard: ↑ moves the exercise up = easier, ↓ down = harder. */}
                  <button type="button" aria-label={`${l.exercise.name}: выше — проще`} disabled={i === 0} onClick={() => run(() => progressionsRepo.move(l.exercise.id, -1))} className="flex h-11 w-9 items-center justify-center rounded-lg border-[1.5px] border-current disabled:opacity-30">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
                  </button>
                  <button type="button" aria-label={`${l.exercise.name}: ниже — сложнее`} disabled={i === levels.length - 1} onClick={() => run(() => progressionsRepo.move(l.exercise.id, 1))} className="flex h-11 w-9 items-center justify-center rounded-lg border-[1.5px] border-current disabled:opacity-30">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                  </button>
                  <button type="button" aria-label={`Исключить «${l.exercise.name}» из прогрессии`} onClick={() => run(() => progressionsRepo.exclude(l.exercise.id))} className="flex h-11 w-9 items-center justify-center rounded-lg border-[1.5px] border-current">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </span>
              ) : (
                <span className={`shrink-0 font-mono text-xs ${isCurrent ? "text-on-inverse-muted" : "text-ink-muted"}`}>{STATE_TEXT[l.state]}</span>
              )}
            </li>
          );
        })}
      </ol>
      {editing && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-snug text-ink-muted">
            Наверху — самый простой вариант. ↑ — выше, проще; ↓ — ниже, сложнее. × убирает упражнение из прогрессии: его тренировки остаются в истории.
          </p>
          <Button variant="outline" onClick={() => setRenaming(chain.progression.name)}>
            Переименовать прогрессию
          </Button>
        </div>
      )}
      <FormError message={error} />

      <h2 className={`${sectionTitle} mt-3 px-1`}>Вся история</h2>
      {timeline.length === 0 && <p className="px-1 text-[15px] text-ink-muted">Ни один вариант ещё не выполнялся.</p>}
      <div className="flex flex-col gap-1.5">
        {timeline.map((item) =>
          item.kind === "transition" ? (
            <div key={`t-${item.exercise.id}`} className="flex items-center gap-2.5 px-1 py-2 text-[13px] font-semibold text-accent-text">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
              {dayMonth(item.date)} — переход на «{item.exercise.name}»
            </div>
          ) : (
            <Link
              key={`${item.session.workoutId}-${item.exercise.id}`}
              href={`/history/view/?id=${item.session.workoutId}`}
              className="flex items-center justify-between gap-2.5 rounded-[14px] border-[1.5px] border-line bg-surface px-3.5 py-2.5"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] text-ink-muted">{formatShortDate(item.session.startedAt)}</span>
                <span className="text-xs text-ink-faint">{item.exercise.name}</span>
              </span>
              <span className="text-right font-mono text-[13px] font-bold">
                {(() => {
                  const done = item.session.sets.filter((s) => s.done_at);
                  return done.length ? formatSetsSummary(item.exercise.log_type, done) : "не выполнено";
                })()}
              </span>
            </Link>
          ),
        )}
      </div>

      <Sheet
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Название прогрессии"
        footer={
          <Button
            variant="primary"
            className="w-full"
            onClick={() =>
              run(async () => {
                await progressionsRepo.rename(chain.progression.id, renaming ?? "");
                setRenaming(null);
              })
            }
          >
            Сохранить
          </Button>
        }
      >
        <Field label="Название" value={renaming ?? ""} onChange={(e) => setRenaming(e.target.value)} />
      </Sheet>
    </div>
  );
}
