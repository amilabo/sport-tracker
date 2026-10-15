"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { formatShortDate, formatTime } from "@/domain/format";
import { deliverBackup, usePreparedBackup, type DeliveryResult } from "@/lib/backup-share";

const RESULT_TEXT: Record<DeliveryResult, string> = {
  shared: "Копия отправлена. Проверьте, что файл дошёл туда, куда вы его сохраняли.",
  downloaded: "Файл копии скачан — он в «Загрузках». Перешлите его туда, где он не потеряется.",
  cancelled: "Отменено — копия не сохранена.",
};

/** «Сохранить копию» (PRD §3.11): all data in one JSON file through «Поделиться», or a download. */
export default function BackupPage() {
  const file = usePreparedBackup();
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
      </div>
    </div>
  );
}
