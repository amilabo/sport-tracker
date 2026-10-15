"use client";

import { useState } from "react";
import { HeightSheet } from "@/components/body/HeightSheet";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { useLive } from "@/db/hooks";
import { measurementsRepo } from "@/db/repos/measurements";
import { settingsRepo } from "@/db/repos/settings";
import { DomainError } from "@/domain/types";

/** «Ещё → Замеры и рост»: height for BMI, the list of measurement types, own types (add, hide, return). */
export default function MeasurementTypesPage() {
  const { data } = useLive(
    async () => ({ types: await measurementsRepo.listTypes({ includeArchived: true }), height: (await settingsRepo.get()).height_cm }),
    [],
    ["measurement_types", "settings"],
  );
  const [heightOpen, setHeightOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", unit: "см" });
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await measurementsRepo.createType(draft);
      setDraft({ name: "", unit: "см" });
    } catch (err) {
      setError(err instanceof DomainError ? err.message : "Не получилось добавить.");
    }
  }

  const label = (name: string, unit: string) => (unit ? `${name}, ${unit}` : name);

  return (
    <div className="flex flex-1 flex-col gap-5 pb-8">
      <PageHeader title="Замеры и рост" backHref="/more/" />

      <section className="mx-4 flex items-center gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-4 py-3">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">Рост</span>
          <span className="text-[13px] text-ink-muted">{data?.height ? `${data.height} см — для ИМТ` : "не указан — ИМТ не считается"}</span>
        </span>
        <Button variant="outline" onClick={() => setHeightOpen(true)}>
          {data?.height ? "Изменить" : "Указать"}
        </Button>
      </section>

      <section className="flex flex-col gap-2 px-4">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Типы замеров</h2>
        <ul className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
          {data?.types.map((t) => (
            <li key={t.id} className={`flex min-h-12 items-center gap-3 border-t border-line px-4 py-1.5 first:border-t-0 ${t.archived_at ? "opacity-60" : ""}`}>
              <span className="flex-1 text-[15px]">{label(t.name, t.unit)}</span>
              {t.computed && <span className="text-xs text-ink-muted">считается сам</span>}
              {!t.is_builtin && (
                <button type="button" onClick={() => measurementsRepo.setTypeArchived(t.id, !t.archived_at)} className="min-h-11 px-1 text-[13px] font-semibold underline underline-offset-2">
                  {t.archived_at ? "Вернуть" : "Скрыть"}
                </button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[13px] leading-snug text-ink-muted">Скрытый тип не показывается при вводе замера, а его старые значения остаются в таблице.</p>
      </section>

      <section className="flex flex-col gap-2 px-4">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Свой тип замера</h2>
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <Field label="Название" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Плечо" />
          <Field label="Единица" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        </div>
        <FormError message={error} />
        <Button variant="primary" onClick={add} disabled={!draft.name.trim()}>
          Добавить
        </Button>
      </section>

      {heightOpen && <HeightSheet open onClose={() => setHeightOpen(false)} current={data?.height ?? null} />}
    </div>
  );
}
