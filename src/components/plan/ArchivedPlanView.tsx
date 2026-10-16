"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { plansRepo } from "@/db/repos/plans";
import { workoutsRepo } from "@/db/repos/workouts";
import { EXERCISE_FORMS, formatShortDate, plural } from "@/domain/format";
import { formatSetsSummary } from "@/domain/sets";
import { DomainError } from "@/domain/types";

const WORKOUT_FORMS: [string, string, string] = ["тренировка", "тренировки", "тренировок"];

/** /more/archive/plan/?id=… — an archived plan, read-only: what was in it, how often it was done; restore. */
export function ArchivedPlanView() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading } = useLive(
    async () => {
      const [full, stats] = await Promise.all([plansRepo.getFull(id), workoutsRepo.planStats(id)]);
      return full ? { ...full, stats } : null;
    },
    [id],
    ["plans", "plan_exercises", "plan_sets", "exercises", "workouts"],
  );

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      await plansRepo.restore(id);
      router.push("/");
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось вернуть. Попробуйте ещё раз.");
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col pb-8">
        <PageHeader title="План в архиве" backHref="/more/archive/" />
        {!loading && <p className="px-4 text-[15px] text-ink-muted">План не найден.</p>}
      </div>
    );
  }

  const { plan, items, stats } = data;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title={plan.archived_at ? "План в архиве" : "План"} backHref="/more/archive/" />

      <section className="mx-4 flex flex-col gap-1.5 rounded-[22px] bg-surface-inverse px-4 pt-[18px] pb-4 text-on-inverse">
        <h2 className="font-display text-2xl leading-[1.1] font-extrabold">{plan.name}</h2>
        <span className="text-[15px] text-on-inverse-muted">
          {items.length} {plural(items.length, EXERCISE_FORMS)}
        </span>
        <span className="text-[15px] text-on-inverse-muted">
          {stats.count > 0
            ? `${stats.count} ${plural(stats.count, WORKOUT_FORMS)} · последняя ${formatShortDate(stats.last!)}`
            : "тренировок по плану не было"}
        </span>
        {plan.archived_at && <span className="text-[15px] text-on-inverse-muted">в архиве с {formatShortDate(plan.archived_at)}</span>}
      </section>

      <ol className="flex flex-col gap-2 px-4">
        {items.map((item, i) => (
          <li key={item.planExercise.id} className="flex gap-3 rounded-[18px] border-[1.5px] border-ink bg-surface py-3.5 pr-3.5 pl-3.5">
            <span className="w-[26px] shrink-0 pt-0.5 font-mono text-sm font-bold text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <Link href={`/exercises/view/?id=${item.exercise.id}`} className="text-base leading-tight font-semibold underline-offset-2 active:underline">
                {item.exercise.name}
              </Link>
              <span className="font-mono text-[15px] font-bold">{formatSetsSummary(item.exercise.log_type, item.sets)}</span>
              {item.planExercise.note && <span className="text-[13px] text-ink-muted">{item.planExercise.note}</span>}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-[15px] text-ink-muted">В плане нет упражнений.</li>}
      </ol>

      <div className="flex flex-col gap-2.5 px-4 pt-1">
        {error && <FormError message={error} />}
        {plan.archived_at ? (
          <>
            <Button variant="accent" size="lg" className="min-h-14 font-display" onClick={restore} disabled={busy}>
              Вернуть план
            </Button>
            <p className="text-[13px] text-ink-muted">
              План снова появится на главной.{stats.count > 0 && " Тренировки по нему никуда не делись — они в истории."}
            </p>
          </>
        ) : (
          <ButtonLink href={`/workout/?plan=${plan.id}`} variant="accent" size="lg" className="min-h-14 font-display">
            К тренировке
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
