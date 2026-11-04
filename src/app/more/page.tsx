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
import { backupRow } from "@/domain/backup-status";
import { formatShortDate } from "@/domain/format";
import { DomainError } from "@/domain/types";
import { useAutoBackup } from "@/lib/auto-backup";
import { getPlatform, IS_ANDROID } from "@/platform";

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

/** The «Копия данных» row in the APK (mockup КД1): how the copy is kept, and the day of the freshest copy of any kind. */
function BackupRow({ row }: { row: { sub: string; hint: string; danger: boolean } }) {
  return (
    <Link href="/more/backup/" className="flex min-h-16 items-center gap-3 px-4 py-2.5">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">Копия данных</span>
        <span className={`text-[13px] ${row.danger ? "text-danger" : "text-ink-muted"}`}>{row.sub}</span>
      </span>
      <span className="font-mono text-[13px] text-ink-muted">{row.hint}</span>
      <Chevron />
    </Link>
  );
}

/**
 * APK only (A4): which file is installed, to compare with the one being sent. A tap adds the top inset as each
 * source has it (1.1.2): if the status bar still covers the top on some phone, these numbers show which one is short.
 */
function VersionLine() {
  const [insets, setInsets] = useState<string | null>(null);
  async function measure() {
    if (insets) return setInsets(null);
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    const px = (value: string) => {
      probe.style.paddingTop = value;
      return getComputedStyle(probe).paddingTop;
    };
    const env = px("env(safe-area-inset-top)");
    const total = px("var(--safe-top)");
    probe.remove();
    const root = getComputedStyle(document.documentElement);
    const native = await (await getPlatform()).screenInsets().catch(() => null);
    const webview = /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] ?? "?";
    setInsets(
      `Отступ сверху: страница ${env} · SystemBars ${root.getPropertyValue("--safe-area-inset-top").trim() || "—"} · ` +
        `Android ${native ? `${native.top}px${native.padded ? " (сдвинуто)" : ""}` : "—"} · итог ${total} · WebView ${webview}`,
    );
  }
  return (
    <button type="button" onClick={measure} className="mx-5 flex min-h-11 flex-col items-center justify-center gap-1 text-center font-mono text-xs text-ink-muted">
      <span>На подходе · версия {process.env.NEXT_PUBLIC_APP_VERSION}</span>
      {insets && <span className="break-words">{insets}</span>}
    </button>
  );
}

/** «Ещё» by groups (stage 30, mockup 29): exercises and plans, settings, data — backup and demo in one card. */
export default function MorePage() {
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const auto = useAutoBackup();
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
          {IS_ANDROID ? (
            <BackupRow row={backupRow({ pref: auto.pref, folder: auto.folder, autoLastAt: auto.lastAt, exportAt: data?.lastExport ?? null })} />
          ) : (
            <LinkRow link={backup} />
          )}
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

      {/* The site is always the latest: no version line there. */}
      {IS_ANDROID && <VersionLine />}
    </div>
  );
}
