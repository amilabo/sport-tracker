"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AutoBackupSection } from "@/components/backup/AutoBackupSection";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { getDb } from "@/db/client";
import { useLive } from "@/db/hooks";
import { backupRepo } from "@/db/repos/backup";
import { settingsRepo } from "@/db/repos/settings";
import { backupStatus, unsentWorkouts, type BackupStatus } from "@/domain/backup-status";
import { formatShortDate, formatTime } from "@/domain/format";
import { toLocalDate } from "@/domain/time";
import { refreshBackupFolder, useAutoBackup } from "@/lib/auto-backup";
import { deliverBackup, shareableBackup, shareBackup, usePreparedBackup, type DeliveryResult } from "@/lib/backup-share";
import { IS_ANDROID } from "@/platform";

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

const RESULT_TEXT: Record<DeliveryResult, string> = {
  shared: IS_ANDROID
    ? "Копия отправлена. Проверьте, что файл дошёл туда, куда вы его отправляли."
    : "Копия отправлена. Проверьте, что файл дошёл туда, куда вы его сохраняли.",
  downloaded: "Файл копии скачан — он в «Загрузках». Перешлите его туда, где он не потеряется.",
  cancelled: IS_ANDROID ? "Отменено — копия не отправлена." : "Отменено — копия не сохранена.",
};

const groupTitle = "px-1 font-display text-xs font-bold tracking-[0.04em] text-ink-muted uppercase";

/** The summary on top (APK, КД2): the freshest copy of either kind, or what is wrong. */
function StatusCard({ status }: { status: BackupStatus }) {
  const look =
    status.kind === "saved"
      ? { box: "bg-surface-inverse text-on-inverse-muted", title: "text-on-inverse", icon: "text-accent-on-inverse" }
      : status.kind === "broken"
        ? { box: "border-2 border-danger bg-surface", title: "text-danger", icon: "text-danger" }
        : { box: "border-2 border-dashed border-line-strong bg-surface", title: "", icon: "" };
  return (
    <section role="status" className={`flex items-start gap-3 rounded-[18px] p-4 ${look.box}`}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${look.icon}`}>
        {status.kind === "saved" && (
          <>
            <circle cx="12" cy="12" r="9.5" />
            <path d="M7.5 12.5l3 3 6-6.5" />
          </>
        )}
        {status.kind === "broken" && <path d="M12 3l10 18H2zM12 10v5M12 18v.01" />}
        {(status.kind === "manual" || status.kind === "waiting") && (
          <>
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7v5l3 2" />
          </>
        )}
      </svg>
      <div className="flex flex-col gap-1">
        <span className={`font-display text-base leading-tight font-bold ${look.title}`}>{status.title}</span>
        <span className="text-sm leading-snug">{status.text}</span>
      </div>
    </section>
  );
}

/**
 * «Копия данных» (PRD §3.11). APK (mockup КД2): the automatic copy on this phone and the copy sent away in one
 * screen, with a summary on top. The site: one file through «Поделиться», or a download.
 */
export default function BackupPage() {
  const router = useRouter();
  const file = usePreparedBackup();
  const shareable = useMemo(() => (file && !IS_ANDROID ? shareableBackup(file) : null), [file]);
  const auto = useAutoBackup();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const { data } = useLive(
    async () => {
      const [settings, workouts] = await Promise.all([settingsRepo.get(), (await getDb()).getAll("workouts")]);
      return { exportAt: settings.last_export_at, unsent: unsentWorkouts(settings.last_export_at, workouts) };
    },
    [],
    ["settings", "workouts"],
  );
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_ANDROID) refreshBackupFolder().catch(console.error);
  }, []);

  async function save() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setResult(await deliverBackup(file));
    } catch (err) {
      console.error(err);
      setError(IS_ANDROID ? "Не получилось отправить копию. Попробуйте ещё раз." : "Не получилось сохранить копию. Попробуйте ещё раз.");
    }
  }

  // Called right inside the tap: Safari and Chrome open the share sheet only from a user action.
  async function share() {
    if (!shareable) return;
    setError(null);
    const r = await shareBackup(shareable);
    if (r === "shared") setResult("shared");
    else if (r === "failed") setError("Не получилось открыть «Поделиться». Файл уже сохранён — его можно отправить из «Загрузок» или «Файлов».");
  }

  async function wipe() {
    setWiping(true);
    setError(null);
    try {
      await backupRepo.wipe();
      try {
        localStorage.removeItem("st-backup-snooze");
      } catch {
        // storage unavailable: nothing to clear
      }
      setConfirmWipe(false);
      router.push("/");
    } catch (err) {
      console.error(err);
      setConfirmWipe(false);
      setError("Не получилось удалить данные. Ничего не изменилось.");
    } finally {
      setWiping(false);
    }
  }

  const last = data?.exportAt ? new Date(data.exportAt) : null;
  const status = data ? backupStatus({ pref: auto.pref, folder: auto.folder, autoLastAt: auto.lastAt, exportAt: data.exportAt, unsent: data.unsent }) : null;
  const sentText = last
    ? `Последняя отправка: ${toLocalDate(last) === toLocalDate(new Date()) ? "сегодня" : formatShortDate(last)}, ${formatTime(last)}`
    : "Копию ещё не отправляли";

  const restore = (
    <Link href="/more/import/" className="flex min-h-14 items-center gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">Восстановить из файла</span>
        <span className="text-[13px] leading-snug text-ink-muted">
          {IS_ANDROID ? "Из автокопии в папке или из отправленного файла" : "Перенести данные из копии на этот телефон"}
        </span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Копия данных" backHref="/more/" />

      {IS_ANDROID ? (
        <div className="flex flex-col gap-4 px-4">
          {status && <StatusCard status={status} />}
          <p className="text-[15px] leading-snug text-ink-muted">
            Все записи хранятся только в этом телефоне. Копия — один файл со всеми тренировками, планами и замерами. Из него можно вернуть всё как было.
          </p>

          <section aria-labelledby="backup-phone" className="flex flex-col gap-2">
            <h2 id="backup-phone" className={groupTitle}>
              На этом телефоне
            </h2>
            <AutoBackupSection />
          </section>

          <section aria-labelledby="backup-away" className="flex flex-col gap-2">
            <h2 id="backup-away" className={groupTitle}>
              Вне телефона
            </h2>
            <div className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-line bg-surface p-4">
              <span className="text-sm leading-snug">
                На случай, если телефон потеряется или сломается: отправьте файл в облако, на почту или себе в мессенджер.
              </span>
              <Button variant="primary" size="xl" className="w-full" onClick={save} disabled={!file}>
                <ShareIcon />
                Отправить копию
              </Button>
              <span className="font-mono text-[13px] text-ink-muted">{sentText}</span>
              {result && (
                <p role="status" className="text-sm leading-snug">
                  {RESULT_TEXT[result]}
                </p>
              )}
              <FormError message={error} />
            </div>
          </section>

          {restore}
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4">
          <p className="text-[15px] leading-snug text-ink-muted">
            Все записи хранятся только в этом телефоне. Сохраняйте копию — в «Файлы», на почту или себе в мессенджер, — чтобы не потерять их при смене телефона или очистке браузера.
          </p>

          <section className="flex flex-col gap-3 rounded-[18px] border-2 border-ink bg-surface p-4">
            <span className="text-[13px] text-ink-muted">{last ? `Последняя копия: ${formatShortDate(last)}, ${formatTime(last)}` : "Копию ещё не сохраняли"}</span>
            <Button variant="primary" size="xl" className="w-full" onClick={save} disabled={!file}>
              Сохранить копию
            </Button>
            {file && <span className="font-mono text-[12px] break-all text-ink-muted">{file.name}</span>}
            {result && (
              <p role="status" className="text-[15px]">
                {RESULT_TEXT[result]}
              </p>
            )}
            {result && result !== "cancelled" && shareable && (
              <Button variant="outline" size="lg" className="w-full" onClick={share}>
                <ShareIcon />
                Поделиться файлом
              </Button>
            )}
            <FormError message={error} />
          </section>

          {restore}
        </div>
      )}

      <section className="mx-4 mt-4 flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Начать с нуля</h2>
        <p className="text-[13px] leading-snug text-ink-muted">
          Удалит из этого телефона все тренировки, планы, упражнения и замеры. Останутся стартовые упражнения и два плана, как при первом запуске.
          {IS_ANDROID ? " Файлы автокопии в папке не удаляются." : ""}
        </p>
        <Button variant="outline" className="w-full" onClick={() => setConfirmWipe(true)}>
          Удалить все данные
        </Button>
      </section>

      <Sheet
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Удалить все данные?"
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="accent" onClick={wipe} disabled={wiping}>
              Удалить всё
            </Button>
            <Button variant="outline" onClick={save} disabled={!file || wiping}>
              {IS_ANDROID ? "Сначала отправить копию" : "Сначала сохранить копию"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmWipe(false)} disabled={wiping}>
              Отмена
            </Button>
          </div>
        }
      >
        <p className="text-[15px] leading-snug">
          Тренировки, планы, упражнения и замеры будут удалены из этого телефона. Отменить это нельзя — вернуть данные можно только из файла копии.
        </p>
        {result && (
          <p role="status" className="mt-2 text-[13px] text-ink-muted">
            {RESULT_TEXT[result]}
          </p>
        )}
      </Sheet>
    </div>
  );
}
