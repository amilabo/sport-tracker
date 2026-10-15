"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { exercisesRepo } from "@/db/repos/exercises";
import { plansRepo } from "@/db/repos/plans";
import { progressionsRepo } from "@/db/repos/progressions";
import { settingsRepo } from "@/db/repos/settings";
import { formatShortDate } from "@/domain/format";

export default function MorePage() {
  const { data } = useLive(
    async () => {
      const [exercises, archivedEx, archivedPlans, settings, chains] = await Promise.all([
        exercisesRepo.list(),
        exercisesRepo.listArchived(),
        plansRepo.listArchived(),
        settingsRepo.get(),
        progressionsRepo.list(),
      ]);
      return {
        catalog: exercises.length,
        archive: archivedEx.length + archivedPlans.length,
        lastExport: settings.last_export_at,
        progressions: chains.length,
      };
    },
    [],
    ["exercises", "plans", "settings", "progressions"],
  );

  const links = [
    { href: "/exercises/", label: "Каталог упражнений", hint: data ? String(data.catalog) : "" },
    { href: "/more/progressions/", label: "Прогрессии", hint: data ? String(data.progressions) : "" },
    { href: "/more/archive/", label: "Архив", hint: data ? String(data.archive) : "" },
    { href: "/more/appearance/", label: "Оформление", hint: "Тема и режим" },
    {
      href: "/more/backup/",
      label: "Копия данных",
      hint: data ? (data.lastExport ? formatShortDate(data.lastExport) : "не сохраняли") : "",
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 pb-5">
      <PageHeader title="Ещё" />
      <section className="mx-5 overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0"
          >
            <span className="flex-1 text-base font-semibold">{link.label}</span>
            <span className="font-mono text-[13px] text-ink-muted">{link.hint}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </section>
    </div>
  );
}
