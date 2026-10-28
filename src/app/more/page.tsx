"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { demoRepo } from "@/db/repos/demo";
import { plansRepo } from "@/db/repos/plans";
import { progressionsRepo } from "@/db/repos/progressions";
import { settingsRepo } from "@/db/repos/settings";
import { formatShortDate } from "@/domain/format";
import { DomainError } from "@/domain/types";

interface MoreLink {
  href: string;
  label: string;
  hint: string;
}

const groupTitle = "px-1 font-display text-xs font-bold tracking-[0.04em] text-ink-muted uppercase";

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LinkRow({ link }: { link: MoreLink }) {
  return (
    <Link href={link.href} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <span className="flex-1 text-base font-semibold">{link.label}</span>
      <span className="font-mono text-[13px] text-ink-muted">{link.hint}</span>
      <Chevron />
    </Link>
  );
}

/** «Ещё» by groups (stage 30, mockup 29): exercises and plans, settings, data — backup and demo in one card. */
export default function MorePage() {
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const { data } = useLive(
    async () => {
      const [exercises, archivedEx, archivedPlans, settings, chains, demo] = await Promise.all([
        exercisesRepo.list(),
        exercisesRepo.listArchived(),
        plansRepo.listArchived(),
        settingsRepo.get(),
        progressionsRepo.list(),
        demoRepo.isLoaded(),
      ]);
      return {
        catalog: exercises.length,
        archive: archivedEx.length + archivedPlans.length,
        lastExport: settings.last_export_at,
        progressions: chains.length,
        height: settings.height_cm,
        goal: settings.weekly_goal,
        demo,
      };
    },
    [],
    ["exercises", "plans", "settings", "progressions", "workouts", "measurements"],
  );

  const groups: { title: string; links: MoreLink[] }[] = [
    {
      title: "Упражнения и планы",
      links: [
        { href: "/rhythm/", label: "Ритм", hint: data ? (typeof data.goal === "number" ? `${data.goal} в неделю` : "цель не задана") : "" },
        { href: "/exercises/", label: "Каталог упражнений", hint: data ? String(data.catalog) : "" },
        { href: "/more/progressions/", label: "Прогрессии", hint: data ? String(data.progressions) : "" },
        { href: "/more/archive/", label: "Архив", hint: data ? String(data.archive) : "" },
      ],
    },
    {
      title: "Настройки",
      links: [
        { href: "/more/measurement-types/", label: "Замеры и рост", hint: data?.height ? `${data.height} см` : "" },
        { href: "/more/appearance/", label: "Оформление", hint: "Тема и режим" },
      ],
    },
  ];
  const backup: MoreLink = {
    href: "/more/backup/",
    label: "Копия данных",
    hint: data ? (data.lastExport ? formatShortDate(data.lastExport) : "не сохраняли") : "",
  };

  return (
    <div className="flex flex-1 flex-col gap-5 pb-5">
      <PageHeader title="Ещё" />

      {groups.map((g, i) => (
        <section key={g.title} aria-labelledby={`more-g${i}`} className="mx-5 flex flex-col gap-2">
          <h2 id={`more-g${i}`} className={groupTitle}>
            {g.title}
          </h2>
          <div className="overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
            {g.links.map((link) => (
              <LinkRow key={link.href} link={link} />
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="more-data" className="mx-5 flex flex-col gap-2">
        <h2 id="more-data" className={groupTitle}>
          Данные
        </h2>
        <div className="overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
          <LinkRow link={backup} />
          <div id="demo" className="flex scroll-mt-4 flex-col gap-3 border-t border-line px-4 pt-3.5 pb-4">
            <div className="flex flex-col gap-2.5">
              <span className="text-base font-semibold">Демо-данные</span>
              <span className="text-[13px] leading-snug text-ink-muted">
                {data?.demo
                  ? "Загружены примеры: 12 тренировок за 4 недели и 4 замера. Удаление уберёт только их — ваши записи останутся."
                  : "12 тренировок за 4 недели и 4 замера, чтобы посмотреть историю и графики. Ваши записи не затрагиваются."}
              </span>
            </div>
            <Button
              variant="outline"
              disabled={!data || demoBusy}
              onClick={async () => {
                setDemoBusy(true);
                setDemoError(null);
                try {
                  await (data?.demo ? demoRepo.remove() : demoRepo.load());
                } catch (err) {
                  setDemoError(err instanceof DomainError ? err.message : "Не получилось. Попробуйте ещё раз.");
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {data?.demo ? "Удалить демо-данные" : "Загрузить демо-данные"}
            </Button>
            <FormError message={demoError} />
          </div>
        </div>
      </section>
    </div>
  );
}
