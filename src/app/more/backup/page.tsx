"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { backupRepo } from "@/db/repos/backup";
import { settingsRepo } from "@/db/repos/settings";
import { formatShortDate, formatTime } from "@/domain/format";
import { deliverBackup, shareableBackup, shareBackup, usePreparedBackup, type DeliveryResult } from "@/lib/backup-share";

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

const RESULT_TEXT: Record<DeliveryResult, string> = {
  shared: "Копия отправлена. Проверьте, что файл дошёл туда, куда вы его сохраняли.",
  downloaded: "Файл копии скачан — он в «Загрузках». Перешлите его туда, где он не потеряется.",
  cancelled: "Отменено — копия не сохранена.",
};

/** «Сохранить копию» (PRD §3.11): all data in one JSON file through «Поделиться», or a download. */
export default function BackupPage() {
  const router = useRouter();
  const file = usePreparedBackup();
  const shareable = useMemo(() => (file ? shareableBackup(file) : null), [file]);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const { data: settings } = useLive(() => settingsRepo.get(), [], ["settings"]);
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setResult(await deliverBackup(file));
    } catch (err) {
      console.error(err);
      setError("Не получилось сохранить копию. Попробуйте ещё раз.");
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

  const last = settings?.last_export_at ? new Date(settings.last_export_at) : null;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Копия данных" backHref="/more/" />

      <div className="flex flex-col gap-4 px-4">
        <p className="text-[15px] leading-snug text-ink-muted">
          Все записи хранятся только в этом телефоне. Сохраняйте копию — в «Файлы», на почту или себе в мессенджер, — чтобы не потерять их при смене телефона или очистке браузера.
        </p>

        <section className="flex flex-col gap-3 rounded-[18px] border-2 border-ink bg-surface p-4">
          <span className="text-[13px] text-ink-muted">
            {last ? `Последняя копия: ${formatShortDate(last)}, ${formatTime(last)}` : "Копию ещё не сохраняли"}
          </span>
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

        <Link
          href="/more/import/"
          className="flex min-h-14 items-center gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3"
        >
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold">Восстановить из файла</span>
            <span className="text-[13px] text-ink-muted">Перенести данные из копии на этот телефон</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <section className="mt-4 flex flex-col gap-2 border-t border-line pt-5">
          <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Начать с нуля</h2>
          <p className="text-[13px] leading-snug text-ink-muted">
            Удалит из этого телефона все тренировки, планы, упражнения и замеры. Останутся стартовые упражнения и два плана, как при первом запуске.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setConfirmWipe(true)}>
            Удалить все данные
          </Button>
        </section>
      </div>

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
              Сначала сохранить копию
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
