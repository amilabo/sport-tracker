"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { progressionsRepo } from "@/db/repos/progressions";

/** «Ещё → Прогрессии»: every chain with its levels; a chain opens on its easiest exercise, tab «Вся прогрессия». */
export default function ProgressionsPage() {
  const { data: chains } = useLive(() => progressionsRepo.list(), [], ["progressions", "exercises"]);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Прогрессии" backHref="/more/" />
      <p className="px-4 text-[15px] leading-snug text-ink-muted">
        Прогрессия связывает варианты одного упражнения от простого к сложному, чтобы прогресс был виден и после перехода на следующий вариант.
      </p>

      {chains && chains.length === 0 && (
        <section className="mx-4 flex flex-col gap-3 rounded-[18px] border-[1.5px] border-dashed border-line-strong bg-surface p-4">
          <span className="text-[15px] font-semibold">Прогрессий пока нет</span>
          <span className="text-[13px] leading-snug text-ink-muted">
            Откройте упражнение в каталоге → «Связать с вариантом» → выберите вариант и скажите, проще он или сложнее.
          </span>
          <ButtonLink href="/exercises/" variant="primary" className="w-full">
            Каталог упражнений
          </ButtonLink>
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
    </div>
  );
}
