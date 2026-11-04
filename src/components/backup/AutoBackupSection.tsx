"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { backupFilesNewestFirst, AUTO_BACKUP_KEEP } from "@/domain/auto-backup";
import { formatDayMonth, formatShortDate, formatTime } from "@/domain/format";
import { toLocalDate } from "@/domain/time";
import { chooseBackupFolder, runAutoBackup, setAutoBackupPref, useAutoBackup } from "@/lib/auto-backup";
import { getPlatform } from "@/platform";

/** The day of a copy is in its name (sport-tracker-backup-2026-10-31.json); the time only if written that day. */
function fileDay(f: { name: string; modified: number }): { day: Date; time: string } {
  const [y, m, d] = (f.name.match(/(\d{4})-(\d{2})-(\d{2})/) ?? []).slice(1).map(Number);
  const day = y ? new Date(y, m - 1, d) : new Date(f.modified);
  const written = new Date(f.modified);
  return { day, time: toLocalDate(written) === toLocalDate(day) ? formatTime(written) : "" };
}

/** "Сегодня, пн 2 ноя" / "Сб, 31 окт". */
function dayLabel(date: Date): string {
  const short = formatShortDate(date);
  if (toLocalDate(date) === toLocalDate(new Date())) return `Сегодня, ${short}`;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function FolderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/** «Копия данных → На этом телефоне» (APK, mockup КД2; was the «Автокопия» screen АК3, stage A3). */
export function AutoBackupSection() {
  const auto = useAutoBackup();
  const [files, setFiles] = useState<{ name: string; modified: number }[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const on = auto.pref === "on";
  const ok = !!auto.folder?.ok;
  const broken = on && !!auto.folder && !ok;

  // The list follows the last copy: a new file appears right after «Сохранить сейчас».
  useEffect(() => {
    if (!on || !ok) return;
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

  const choose = async () => (await chooseBackupFolder()).status;

  function toggle() {
    if (on) return setAutoBackupPref("off");
    // Turning on without a folder goes straight to Android's picker.
    if (!auto.folder) return act(choose);
    setAutoBackupPref("on");
    act(() => runAutoBackup("now"));
  }

  const latest = auto.lastAt ? new Date(auto.lastAt) : null;
  // Today — the time of the newest file; another day — its date (the full list is one tap away).
  const latestShort = latest ? (toLocalDate(latest) === toLocalDate(new Date()) ? formatTime(latest) : formatDayMonth(latest)) : "";

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] border-2 border-ink bg-surface p-4">
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
      <span className="text-sm leading-snug text-ink-muted">
        {on
          ? "Сама сохраняет копию в папку: после тренировки, после замера и при открытии, если что-то изменилось."
          : "Выключена. Включите — и копия будет сохраняться сама после каждой тренировки и замера."}
      </span>

      {on && auto.folder && (
        <div className="flex items-center gap-3 border-t border-line pt-3">
          <span className={broken ? "text-danger" : ""}>
            <FolderIcon />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] text-ink-muted">Папка</span>
            <span className={`text-[15px] font-semibold break-words ${broken ? "text-danger" : ""}`}>
              {auto.folder.name}
              {broken ? " — нет доступа" : ""}
            </span>
          </div>
          <Button variant={broken ? "primary" : "outline"} size="md" className="shrink-0" onClick={() => act(choose)} disabled={busy}>
            {broken ? "Выбрать" : "Сменить"}
          </Button>
        </div>
      )}
      {broken && <p className="text-sm leading-snug text-danger">Нет доступа к папке — её удалили или переименовали. Выберите папку заново, и автокопия продолжится.</p>}

      {on && ok && (
        <>
          {files && files.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="flex min-h-11 items-center gap-2.5 text-left"
              >
                <span className="flex-1 text-[15px] font-semibold">В папке — {AUTO_BACKUP_KEEP} последних дней</span>
                <span className="font-mono text-[13px] whitespace-nowrap text-ink-muted">{latestShort}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {open && (
                <ul className="overflow-hidden rounded-[14px] border-[1.5px] border-line">
                  {files.map((f, i) => {
                    const { day, time } = fileDay(f);
                    return (
                      <li key={f.name} className="flex min-h-11 items-center gap-3 border-t border-line px-3.5 first:border-t-0">
                        <span className={`flex-1 text-sm ${i === 0 ? "font-semibold" : ""}`}>{dayLabel(day)}</span>
                        <span className="font-mono text-[13px] text-ink-muted">{time}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => act(() => runAutoBackup("now"))} disabled={busy}>
            Сохранить сейчас
          </Button>
        </>
      )}
      {note && (
        <p role="status" className="text-sm leading-snug text-ink-muted">
          {note}
        </p>
      )}
      <FormError message={error} />

      <p className="border-t border-line pt-3 text-[13px] leading-snug text-ink-muted">
        Файлы в папке остаются, даже если удалить приложение. Но если потеряется сам телефон — пропадут вместе с ним.
      </p>
    </div>
  );
}
