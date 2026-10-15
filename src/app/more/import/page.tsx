"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useLive } from "@/db/hooks";
import { backupRepo, type ImportMode, type ImportResult } from "@/db/repos/backup";
import { backupCounts, parseBackup, type BackupFile } from "@/domain/backup";
import { formatShortDate, formatTime, plural } from "@/domain/format";
import { DomainError } from "@/domain/types";

const count = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;

/** «Восстановить из файла» (PRD §3.11): read the file, show what is inside, then «Объединить» or «Заменить всё». */
export default function ImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; backup: BackupFile } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [done, setDone] = useState<{ mode: ImportMode; result: ImportResult } | null>(null);
  const { data: phone } = useLive(async () => backupCounts(await backupRepo.exportAll()), []);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setDone(null);
    try {
      setFile({ name: f.name, backup: parseBackup(await f.text()) });
    } catch (err) {
      setFile(null);
      setError(err instanceof DomainError ? err.message : "Не получилось прочитать файл");
    }
  }

  async function run(mode: ImportMode) {
    if (!file) return;
    setConfirmReplace(false);
    setBusy(true);
    setError(null);
    try {
      const result = await backupRepo.import(file.backup, mode);
      setDone({ mode, result });
      setFile(null);
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось восстановить. Данные в телефоне не изменились");
      if (!(err instanceof DomainError)) console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const counts = file ? backupCounts(file.backup) : null;
  const exportedAt = file?.backup.exported_at ? new Date(file.backup.exported_at) : null;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader title="Восстановить из файла" backHref="/more/backup/" />

      <div className="flex flex-col gap-4 px-4">
        <p className="text-[15px] leading-snug text-ink-muted">
          Файл копии — тот, что приложение сохраняет через «Поделиться». Он переносит тренировки, планы и упражнения на этот телефон.
        </p>

        <input ref={input} type="file" accept=".json,application/json" onChange={pick} className="hidden" />
        <Button variant={file ? "outline" : "primary"} size="xl" className="w-full" onClick={() => input.current?.click()} disabled={busy}>
          {file ? "Выбрать другой файл" : "Выбрать файл"}
        </Button>

        {file && counts && (
          <section className="flex flex-col gap-3 rounded-[18px] border-2 border-ink bg-surface p-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[13px] break-all text-ink-muted">{file.name}</span>
              {exportedAt && !Number.isNaN(exportedAt.getTime()) && (
                <span className="text-[13px] text-ink-muted">
                  Копия от {formatShortDate(exportedAt)}, {formatTime(exportedAt)}
                </span>
              )}
            </div>
            <table className="w-full text-[15px]">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th scope="col" className="pb-1 font-medium" />
                  <th scope="col" className="pb-1 font-medium">Сейчас</th>
                  <th scope="col" className="pb-1 font-medium">В файле</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(
                  [
                    ["Тренировки", "workouts"],
                    ["Планы", "plans"],
                    ["Упражнения", "exercises"],
                    ["Замеры", "measurements"],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key} className="border-t border-line">
                    <th scope="row" className="py-1.5 text-left font-sans font-normal text-ink-muted">
                      {label}
                    </th>
                    <td className="py-1.5 font-bold">{phone ? phone[key] : "…"}</td>
                    <td className="py-1.5 font-bold">{counts[key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-col gap-2 pt-1">
              <Button variant="primary" size="xl" className="w-full" onClick={() => run("merge")} disabled={busy}>
                Объединить
              </Button>
              <p className="text-[13px] leading-snug text-ink-muted">
                Добавит из файла то, чего нет в телефоне. Ничего не удаляет.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setConfirmReplace(true)} disabled={busy}>
                Заменить всё
              </Button>
            </div>
          </section>
        )}

        <FormError message={error} />

        {done && (
          <section role="status" className="flex flex-col gap-3 rounded-[18px] bg-surface-inverse p-4 text-on-inverse">
            <span className="font-display text-xl leading-tight font-extrabold">Готово</span>
            <span className="text-[15px] text-on-inverse-muted">
              {done.mode === "replace"
                ? "Данные телефона заменены данными из файла."
                : done.result.added + done.result.updated === 0
                  ? "Всё из файла уже есть в телефоне — ничего не изменилось."
                  : done.result.workoutsAdded > 0
                    ? `Добавлено: ${count(done.result.workoutsAdded, ["тренировка", "тренировки", "тренировок"])}.`
                    : "Данные из файла добавлены."}
            </span>
            {done.result.renamed.length > 0 && (
              <span className="text-[13px] text-on-inverse-muted">
                Названия уже были заняты, поэтому переименованы: {done.result.renamed.join(", ")}
              </span>
            )}
            <ButtonLink href="/" variant="accent" className="w-full">
              К тренировкам
            </ButtonLink>
          </section>
        )}
      </div>

      <Sheet
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="Заменить всё?"
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="accent" onClick={() => run("replace")} disabled={busy}>
              Да, заменить всё
            </Button>
            <Button variant="outline" onClick={() => setConfirmReplace(false)}>
              Отмена
            </Button>
          </div>
        }
      >
        <p className="text-[15px]">
          Все тренировки, планы и упражнения в этом телефоне будут удалены и заменены содержимым файла. Отменить это нельзя.
        </p>
      </Sheet>
    </div>
  );
}
