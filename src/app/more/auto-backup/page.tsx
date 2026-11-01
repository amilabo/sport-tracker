"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { backupFilesNewestFirst, AUTO_BACKUP_KEEP } from "@/domain/auto-backup";
import { formatShortDate, formatTime } from "@/domain/format";
import { toLocalDate } from "@/domain/time";
import {
  chooseBackupFolder,
  refreshBackupFolder,
  runAutoBackup,
  setAutoBackupPref,
  useAutoBackup,
} from "@/lib/auto-backup";
import { getPlatform, IS_ANDROID } from "@/platform";

/** The day of a copy is in its name (sport-tracker-backup-2026-10-31.json); the time only if written that day. */
function fileDay(f: { name: string; modified: number }): { day: Date; time: string } {
  const [y, m, d] = (f.name.match(/(\d{4})-(\d{2})-(\d{2})/) ?? []).slice(1).map(Number);
  const day = y ? new Date(y, m - 1, d) : new Date(f.modified);
  const written = new Date(f.modified);
  return { day, time: toLocalDate(written) === toLocalDate(day) ? formatTime(written) : "" };
}

/** "Сегодня, вс 1 ноя" / "Сб, 31 окт". */
function dayLabel(date: Date): string {
  const short = formatShortDate(date);
  if (toLocalDate(date) === toLocalDate(new Date())) return `Сегодня, ${short}`;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function lastCopyText(lastAt: string | null): string {
  if (!lastAt) return "Ещё не сохранялась";
  const d = new Date(lastAt);
  const day = toLocalDate(d) === toLocalDate(new Date()) ? "сегодня" : formatShortDate(d);
  return `Последняя автокопия: ${day}, ${formatTime(d)}`;
}

/** «Ещё → Автокопия» (stage A3, mockup АК3): APK only. */
export default function AutoBackupPage() {
  const auto = useAutoBackup();
  const [files, setFiles] = useState<{ name: string; modified: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const on = auto.pref === "on";
  const ok = !!auto.folder?.ok;

  useEffect(() => {
    refreshBackupFolder().catch(console.error);
  }, []);

  // The list follows the last copy: a new file appears right after «Сохранить сейчас».
  useEffect(() => {
    if (!IS_ANDROID || !on || !ok) return;
    let alive = true;
    getPlatform()
      .then((p) => p.autoBackup.list())
      .then((list) => alive && setFiles(backupFilesNewestFirst(list).slice(0, AUTO_BACKUP_KEEP)))
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [on, ok, auto.lastAt]);

  async function act(step: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await step();
      if (result === "failed") setError("Не получилось записать копию в папку. Выберите папку заново.");
      if (result === "empty") setNote("Пока нечего сохранять: нет ни одной тренировки и ни одного замера.");
      if (result === "kept")
        setNote("В папке уже есть сегодняшняя копия, сохранённая раньше. Чтобы её не затереть, автокопия начнётся завтра или после «Восстановить из файла».");
    } catch (err) {
      console.error(err);
      setError("Не получилось. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    if (on) return setAutoBackupPref("off");
    // Turning on without a folder goes straight to Android's picker.
    if (!auto.folder) return act(choose);
    setAutoBackupPref("on");
    act(() => runAutoBackup("now"));
  }

  const choose = async () => (await chooseBackupFolder()).status;

  if (!IS_ANDROID) {
    return (
      <div className="flex flex-1 flex-col gap-4 pb-8">
        <PageHeader title="Автокопия" backHref="/more/" />
        <p className="px-4 text-[15px] leading-snug text-ink-muted">
          Автокопия есть только в приложении для Android. На сайте сохраняйте копию в «Ещё → Копия данных».
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Автокопия" backHref="/more/" />

      <div className="flex flex-col gap-4 px-4">
        <p className="text-[15px] leading-snug text-ink-muted">
          Приложение само сохраняет копию всех данных в папку на этом телефоне: после тренировки, после замера и при открытии, если что-то изменилось.
        </p>

        <section className="flex flex-col gap-3.5 rounded-[18px] border-2 border-ink bg-surface p-4">
          <div className="flex items-center gap-3">
            <span id="auto-label" className="flex-1 text-[17px] font-bold">
              Автокопия
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby="auto-label"
              onClick={toggle}
              disabled={busy}
              className={`flex h-8 w-14 shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50 ${on ? "justify-end bg-surface-inverse" : "justify-start bg-ink-muted"}`}
            >
              <span className="block h-[26px] w-[26px] rounded-full bg-surface" />
            </button>
          </div>
          <span className="text-sm text-ink-muted">
            {on ? lastCopyText(auto.lastAt) : "Выключена. Копию можно сохранять вручную в «Копии данных»."}
          </span>
          {on && ok && (
            <Button variant="primary" onClick={() => act(() => runAutoBackup("now"))} disabled={busy}>
              Сохранить сейчас
            </Button>
          )}
          {note && (
            <p role="status" className="text-sm leading-snug text-ink-muted">
              {note}
            </p>
          )}
          <FormError message={error} />
        </section>

        {on && auto.folder && (
          <section className={`flex flex-col gap-3 rounded-[18px] border-[1.5px] bg-surface p-4 ${ok ? "border-line" : "border-danger"}`}>
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] text-ink-muted">Папка</span>
                <span className="text-base font-semibold">{auto.folder.name}</span>
              </div>
            </div>
            {!ok && <p className="text-sm leading-snug text-danger">Нет доступа к папке — её удалили или переименовали. Выберите папку заново.</p>}
            <Button variant={ok ? "outline" : "primary"} onClick={() => act(choose)} disabled={busy}>
              {ok ? "Сменить папку" : "Выбрать папку"}
            </Button>
          </section>
        )}

        {on && ok && files && files.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 font-display text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">В папке — {AUTO_BACKUP_KEEP} последних дней</h2>
            <ul className="overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
              {files.map((f, i) => {
                const { day, time } = fileDay(f);
                return (
                  <li key={f.name} className="flex min-h-12 items-center gap-3 border-t border-line px-4 first:border-t-0">
                    <span className={`flex-1 text-[15px] ${i === 0 ? "font-semibold" : ""}`}>{dayLabel(day)}</span>
                    <span className="font-mono text-[13px] text-ink-muted">{time}</span>
                  </li>
                );
              })}
            </ul>
            <p className="px-1 text-[13px] leading-snug text-ink-muted">
              Файл дня перезаписывается, файлы старше пяти дней удаляются сами. Имя файла — как у ручной копии: {files[0].name}.
            </p>
          </section>
        )}

        <section className="flex flex-col gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-line-strong px-4 py-3.5">
          <span className="text-[15px] font-semibold">Если удалить приложение</span>
          <span className="text-sm leading-snug text-ink-muted">
            Файлы в папке останутся. После установки заново: «Копия данных → Восстановить из файла» → самый свежий файл из этой папки.
          </span>
        </section>
      </div>
    </div>
  );
}
