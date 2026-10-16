"use client";

import Link from "next/link";
import { useState } from "react";
import { ExercisePicker } from "@/components/exercises/ExercisePicker";
import { LinkVariant } from "@/components/exercises/LinkVariant";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { progressionsRepo } from "@/db/repos/progressions";
import type { Exercise } from "@/domain/types";

/** «Ещё → Прогрессии»: every chain with its levels; a chain opens on its easiest exercise, tab «Вся прогрессия». */
export default function ProgressionsPage() {
  const { data: chains } = useLive(() => progressionsRepo.list(), [], ["progressions", "exercises"]);
  // «+ Новая прогрессия»: first the exercise to start from, then the usual «Связать с вариантом».
  const [picking, setPicking] = useState(false);
  const [first, setFirst] = useState<Exercise | null>(null);
  const inChains = chains?.flatMap((c) => c.members.map((m) => m.id)) ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Прогрессии" backHref="/more/" />
      <p className="px-4 text-[15px] leading-snug text-ink-muted">
        Прогрессия связывает варианты одного упражнения от простого к сложному, чтобы прогресс был виден и после перехода на следующий вариант.
      </p>

      {chains && chains.length === 0 && (
        <section className="mx-4 flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4">
          <span className="text-[15px] font-semibold">Прогрессий пока нет</span>
          <span className="text-[13px] leading-snug text-ink-muted">
            «+ Новая прогрессия» → выберите упражнение, затем его вариант и скажите, проще он или сложнее. То же можно сделать на экране упражнения: «Связать с вариантом».
          </span>
        </section>
      )}

      <ul className="flex flex-col gap-2 px-4">
        {chains?.map(({ progression, members }) => (
          <li key={progression.id}>
            <Link
              href={`/exercises/view/?id=${members[0]?.id ?? ""}&tab=chain`}
              className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3.5"
            >
              <span className="font-display text-base leading-tight font-bold">{progression.name}</span>
              <span className="text-[13px] leading-snug text-ink-muted">{members.map((m) => m.name).join(" → ")}</span>
            </Link>
          </li>
        ))}
      </ul>

      {chains && (
        <div className="px-4">
          <Button variant={chains.length ? "ghost" : "primary"} size="lg" className="w-full" onClick={() => setPicking(true)}>
            + Новая прогрессия
          </Button>
        </div>
      )}

      <ExercisePicker
        open={picking}
        title="С какого упражнения начать?"
        disabledIds={inChains}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false);
          setFirst(e);
        }}
      />
      {first && <LinkVariant key={first.id} exercise={first} inChain={false} open onClose={() => setFirst(null)} />}
    </div>
  );
}
