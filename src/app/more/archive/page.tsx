"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { plansRepo } from "@/db/repos/plans";
import { MUSCLE_GROUP_LABELS } from "@/domain/labels";
import { DomainError } from "@/domain/types";

export default function ArchivePage() {
  const [error, setError] = useState<string | null>(null);
  const restore = (action: () => Promise<void>) => {
    setError(null);
    action().catch((err) => setError(err instanceof DomainError ? err.message : "Не получилось вернуть. Попробуйте ещё раз."));
  };
  const { data } = useLive(
    async () => {
      const [exercises, plans] = await Promise.all([exercisesRepo.listArchived(), plansRepo.listArchived()]);
      return { exercises, plans };
    },
    [],
    ["exercises", "plans"],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 pb-8">
      <PageHeader title="Архив" backHref="/more/" />
      {error && (
        <div className="px-4">
          <FormError message={error} />
        </div>
      )}
      {data && data.exercises.length === 0 && data.plans.length === 0 && (
        <p className="px-4 text-[15px] text-ink-muted">Архив пуст. Сюда попадают упражнения и планы, которые вы убрали.</p>
      )}

      {data && data.plans.length > 0 && (
        <section className="flex flex-col gap-2 px-4">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Планы</h2>
          <ul className="flex flex-col">
            {data.plans.map((p) => (
              <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-line last:border-b-0">
                <Link href={`/more/archive/plan/?id=${p.id}`} className="flex min-w-0 flex-1 flex-col py-2">
                  <span className="text-base font-semibold">{p.name}</span>
                  <span className="text-[13px] text-ink-muted">посмотреть план</span>
                </Link>
                <Button size="md" variant="outline" onClick={() => restore(() => plansRepo.restore(p.id))}>
                  Вернуть
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.exercises.length > 0 && (
        <section className="flex flex-col gap-2 px-4">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Упражнения</h2>
          <ul className="flex flex-col">
            {data.exercises.map((e) => (
              <li key={e.id} className="flex min-h-14 items-center gap-3 border-b border-line last:border-b-0">
                <Link href={`/exercises/view/?id=${e.id}`} className="flex min-w-0 flex-1 flex-col py-2">
                  <span className="text-base font-semibold">{e.name}</span>
                  <span className="text-[13px] text-ink-muted">{MUSCLE_GROUP_LABELS[e.muscle_group]}</span>
                </Link>
                <Button size="md" variant="outline" onClick={() => restore(() => exercisesRepo.restore(e.id))}>
                  Вернуть
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
