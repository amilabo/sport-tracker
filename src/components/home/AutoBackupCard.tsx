"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Snackbar } from "@/components/ui/Snackbar";
import { formatDayMonth } from "@/domain/format";
import { chooseBackupFolder, hideAutoBackupAlert, setAutoBackupPref, useAutoBackup } from "@/lib/auto-backup";

function FolderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v5M9.5 13.5L12 16l2.5-2.5" />
    </svg>
  );
}

const PICK_FAILED = "Папку выбрали, но записать копию не получилось. Попробуйте другую папку.";

/**
 * APK home (stage A3): «Куда сохранять автокопии?» once on the first launch (АК1),
 * «Автокопия не сохраняется» when the folder is gone (АК4). Rendered only in the APK.
 */
export function AutoBackupCard() {
  const auto = useAutoBackup();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hideToast = useCallback(() => setToast(null), []);

  async function choose() {
    setBusy(true);
    try {
      const { status, latestCopy } = await chooseBackupFolder();
      if (status === "saved") setToast("Автокопия сохранена. Дальше — после каждой тренировки и замера.");
      else if (status === "failed") setToast(PICK_FAILED);
      else if (status === "empty")
        setToast(
          latestCopy
            ? `Папка выбрана. В ней есть копия от ${formatDayMonth(`${latestCopy}T12:00:00`)} — вернуть данные: «Ещё → Копия данных → Восстановить из файла».`
            : "Папка выбрана. Первая автокопия — после первой тренировки или замера.",
        );
    } catch (err) {
      console.error(err);
      setToast(PICK_FAILED);
    } finally {
      setBusy(false);
    }
  }

  const asking = auto.pref === null && auto.folder === null;
  const broken = auto.pref === "on" && !!auto.folder && !auto.folder.ok && !auto.alertHidden;

  return (
    <>
      {asking && (
        <section aria-label="Автокопия" className="flex flex-col gap-3 rounded-[18px] border-2 border-dashed border-ink bg-surface p-4">
          <div className="flex items-start gap-3">
            <FolderIcon />
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-[17px] leading-tight font-bold">Куда сохранять автокопии?</h2>
              <p className="text-sm leading-snug">
                После тренировки и замера приложение само сохранит копию в папку на этом телефоне. Файлы останутся, даже если удалить приложение.
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={choose} disabled={busy}>
            Выбрать папку
          </Button>
          <p className="text-[13px] leading-snug text-ink-muted">Android спросит один раз. Удобно создать в «Documents» папку «На подходе».</p>
          <button
            type="button"
            onClick={() => {
              setAutoBackupPref("off");
              setToast("Автокопия выключена. Включить — «Ещё → Копия данных».");
            }}
            className="min-h-11 text-sm font-semibold text-ink-muted underline underline-offset-[3px]"
          >
            Без автокопии
          </button>
        </section>
      )}

      {broken && auto.folder && (
        <section role="alert" aria-label="Автокопия" className="flex flex-col gap-3 rounded-[18px] border-2 border-danger bg-surface p-3.5">
          <div className="flex items-start gap-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-danger">
              <path d="M12 3l10 18H2z" />
              <path d="M12 10v5M12 18v.01" />
            </svg>
            <div className="flex flex-col gap-1">
              <span className="text-base font-bold text-danger">Автокопия не сохраняется</span>
              <span className="text-sm leading-snug">
                Нет доступа к папке «{auto.folder.name}» — её удалили или переименовали.
                {auto.lastAt ? ` Последняя автокопия — ${formatDayMonth(auto.lastAt)}.` : ""}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={hideAutoBackupAlert}>
              Позже
            </Button>
            <Button variant="primary" onClick={choose} disabled={busy}>
              Выбрать папку
            </Button>
          </div>
        </section>
      )}

      <Snackbar message={toast} onClose={hideToast} ms={5000} aboveNav />
    </>
  );
}
