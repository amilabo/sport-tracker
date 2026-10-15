"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackupReminder } from "@/components/home/BackupReminder";
import { InstallHint } from "@/components/home/InstallHint";
import { SavedWorkout } from "@/components/home/SavedWorkout";
import { TodayLabel } from "@/components/TodayLabel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { plansRepo } from "@/db/repos/plans";
import { workoutsRepo } from "@/db/repos/workouts";
import { EXERCISE_FORMS, formatShortDate, formatTime, plural } from "@/domain/format";
import { pickNextPlan } from "@/domain/next-plan";
import { planChanges } from "@/domain/plan-diff";
import { PlanUpdateList } from "@/components/workout/PlanUpdateList";
import type { Id, Plan, Workout } from "@/domain/types";
import { progress } from "@/domain/workout";

interface PlanRow {
  plan: Plan;
  count: number;
  last: string | null;
}

interface ActiveInfo {
  workout: Workout;
  title: string;
  done: number;
  total: number;
}

function lastLine(last: string | null) {
  return last ? `последняя ${formatShortDate(last)}` : "ещё не было";
}

function PlayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function NextCard({ row, onStart, busy }: { row: PlanRow; onStart: () => void; busy: boolean }) {
  return (
    <section aria-label="Следующая тренировка" className="flex flex-col gap-3.5 rounded-[22px] bg-surface-inverse px-4 pt-[18px] pb-4 text-on-inverse">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-on-inverse-muted">Следующая по очереди</span>
        <span className="font-display text-2xl leading-[1.1] font-extrabold">{row.plan.name}</span>
        <span className="text-[15px] text-on-inverse-muted">
          {row.count} {plural(row.count, EXERCISE_FORMS)}
        </span>
        <span className="text-[15px] text-on-inverse-muted">{lastLine(row.last)}</span>
      </div>
      <Button variant="accent" size="xl" className="w-full" onClick={onStart} disabled={busy}>
        <PlayIcon size={22} />
        Начать тренировку
      </Button>
    </section>
  );
}

function ActiveCard({ active }: { active: ActiveInfo }) {
  return (
    <section aria-label="Идёт тренировка" className="flex flex-col gap-3.5 rounded-[22px] bg-surface-inverse px-4 pt-[18px] pb-4 text-on-inverse">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-accent">Идёт тренировка</span>
        <span className="font-display text-2xl leading-[1.1] font-extrabold">{active.title}</span>
        <span className="text-[15px] text-on-inverse-muted">начало {formatTime(active.workout.started_at)}</span>
        <span className="text-[15px] text-on-inverse-muted">
          выполнено {active.done} из {active.total}
        </span>
      </div>
      <ButtonLink href={`/workout/?id=${active.workout.id}`} variant="accent" size="xl" className="w-full">
        <PlayIcon size={22} />
        Продолжить
      </ButtonLink>
    </section>
  );
}

function PlanCard({ row, onStart }: { row: PlanRow; onStart: () => void }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-surface">
      <button type="button" onClick={onStart} className="flex min-w-0 flex-1 items-center gap-3.5 py-4 pr-3.5 pl-4 text-left active:bg-surface-done">
        <span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full ${row.last ? "bg-accent text-on-accent" : "bg-line text-ink"}`}>
          <PlayIcon />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[17px] leading-[1.15] font-bold">{row.plan.name}</span>
          <span className="text-[13px] text-ink-muted">
            {row.count} {plural(row.count, EXERCISE_FORMS)}
          </span>
          <span className="text-[13px] text-ink-muted">{lastLine(row.last)}</span>
        </span>
      </button>
      <Link
        href={`/plans/edit/?id=${row.plan.id}`}
        aria-label={`Редактировать план «${row.plan.name}»`}
        className="flex w-13 shrink-0 items-center justify-center border-l-[1.5px] border-line"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16z" />
        </svg>
      </Link>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ active: Workout; planId: Id | null } | null>(null);

  const { data } = useLive(
    async () => {
      const [plans, counts, last, activeWorkout] = await Promise.all([
        plansRepo.list(),
        plansRepo.exerciseCounts(),
        workoutsRepo.lastStartedByPlan(),
        workoutsRepo.getActive(),
      ]);
      const rows: PlanRow[] = plans.map((plan) => ({ plan, count: counts.get(plan.id) ?? 0, last: last.get(plan.id) ?? null }));
      const next = pickNextPlan(plans, last);
      let active: ActiveInfo | null = null;
      if (activeWorkout) {
        const full = await workoutsRepo.getFull(activeWorkout.id);
        if (full) active = { workout: full.workout, title: full.plan?.name ?? "Без плана", ...progress(full.items) };
      }
      return {
        active,
        next: rows.find((r) => r.plan.id === next?.id) ?? null,
        others: rows.filter((r) => r.plan.id !== next?.id),
      };
    },
    [],
    ["plans", "plan_exercises", "workouts", "workout_exercises", "workout_sets"],
  );

  // «Обновить веса в плане?» for a workout finished without the finish screen (PRD §3.13).
  const { data: pending } = useLive(
    async () => {
      const w = await workoutsRepo.pendingPlanPrompt();
      if (!w) return null;
      const full = w.plan_id ? await workoutsRepo.getFull(w.id) : undefined;
      const changes = full?.plan && !full.plan.archived_at ? planChanges(full.items) : [];
      if (!full?.plan || changes.length === 0) {
        // Nothing to ask: settle it silently (the query re-runs and checks the next one).
        await workoutsRepo.markPlanPrompted(w.id);
        return null;
      }
      return { workout: w, plan: full.plan, changes };
    },
    [],
    ["workouts", "plans"],
  );
  const [planBusy, setPlanBusy] = useState(false);

  async function decidePending(checked: Parameters<typeof plansRepo.applySetUpdates>[0]) {
    if (!pending) return;
    setPlanBusy(true);
    try {
      await plansRepo.applySetUpdates(checked);
      await workoutsRepo.markPlanPrompted(pending.workout.id);
    } finally {
      setPlanBusy(false);
    }
  }

  /** One tap: start and open the workout. If another one is in progress — ask (PRD §3.13). */
  async function begin(planId: Id | null) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await workoutsRepo.start(planId);
      if (r.status === "started") router.push(`/workout/?id=${r.id}`);
      else setConflict({ active: r.active, planId });
    } finally {
      setBusy(false);
    }
  }

  async function finishAndBegin() {
    if (!conflict) return;
    const { active, planId } = conflict;
    setConflict(null);
    await workoutsRepo.finish(active.id);
    await begin(planId);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-5">
      <div className="-mx-5">
        <PageHeader title="Тренировки" eyebrow={<TodayLabel />} />
      </div>

      <SavedWorkout />
      <InstallHint />

      {data?.active && <ActiveCard active={data.active} />}

      {data && !data.active && (data.next ? (
        <NextCard row={data.next} onStart={() => begin(data.next!.plan.id)} busy={busy} />
      ) : (
        <section className="flex flex-col gap-3 rounded-[22px] bg-surface-inverse p-4 text-on-inverse">
          <span className="font-display text-xl leading-tight font-extrabold">Начнём с плана</span>
          <span className="text-[15px] text-on-inverse-muted">Перенесите программу тренера — потом тренировка запускается в один тап.</span>
          <ButtonLink href="/plans/edit/?new=1" variant="accent" size="xl" className="w-full">
            Создать первый план
          </ButtonLink>
        </section>
      ))}

      {data && (data.active ? [...(data.next ? [data.next] : []), ...data.others] : data.others).length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-bold tracking-[0.02em] uppercase">
              {data.active ? "Планы" : "Или другой план"}
            </h2>
            <span className="font-mono text-[13px] text-ink-muted">
              {data.active ? data.others.length + (data.next ? 1 : 0) : data.others.length}
            </span>
          </div>
          {(data.active ? [...(data.next ? [data.next] : []), ...data.others] : data.others).map((row) => (
            <PlanCard key={row.plan.id} row={row} onStart={() => begin(row.plan.id)} />
          ))}
        </section>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-2.5">
          <ButtonLink href="/plans/edit/?new=1" variant="outline">
            + Новый план
          </ButtonLink>
          <Button variant="outline" onClick={() => begin(null)} disabled={busy}>
            Без плана
          </Button>
        </div>
      )}

      {data?.next && !data.active && (
        <Link href={`/plans/edit/?id=${data.next.plan.id}`} className="-mt-2 self-start py-2 text-[13px] text-ink-muted underline underline-offset-2">
          Изменить «{data.next.plan.name}»
        </Link>
      )}

      <BackupReminder />

      <p className="mt-auto flex items-center gap-2.5 text-[13px] text-ink-muted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        Данные хранятся только на этом телефоне
      </p>

      <Sheet
        open={!!pending && !data?.active && conflict === null}
        onClose={() => decidePending([])}
        title="Обновить веса в плане?"
      >
        {pending && (
          <div className="flex flex-col gap-2">
            <p className="text-[15px]">
              Тренировка {formatShortDate(pending.workout.started_at)} по плану «{pending.plan.name}»
              {pending.workout.status === "auto_finished" ? " завершилась автоматически." : " завершена."}
            </p>
            <PlanUpdateList
              key={pending.workout.id}
              planName={pending.plan.name}
              changes={pending.changes}
              busy={planBusy}
              onDecide={(checked) => decidePending(checked.flatMap((c) => c.updates))}
            />
          </div>
        )}
      </Sheet>

      <Sheet
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="Уже идёт тренировка"
        footer={
          <div className="flex flex-col gap-2">
            <ButtonLink href={conflict ? `/workout/?id=${conflict.active.id}` : "/workout/"} variant="primary" onClick={() => setConflict(null)}>
              Продолжить текущую
            </ButtonLink>
            <Button variant="outline" onClick={finishAndBegin}>
              Завершить её и начать новую
            </Button>
          </div>
        }
      >
        <p className="text-[15px]">
          Тренировка начата в {conflict ? formatTime(conflict.active.started_at) : ""}. Одновременно может идти только одна. Продолжить её или завершить
          и начать новую?
        </p>
      </Sheet>
    </div>
  );
}
