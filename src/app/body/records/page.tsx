"use client";

import { useState } from "react";
import { HeightSheet } from "@/components/body/HeightSheet";
import { MeasurementSheet } from "@/components/body/MeasurementSheet";
import { fullDate, useBodyData } from "@/components/body/parts";
import { PageHeader } from "@/components/ui/PageHeader";
import type { BodySession } from "@/domain/body";
import { enteredCount } from "@/domain/body-compare";
import { plural } from "@/domain/format";

/** All measurement sessions, newest first: tap — edit or delete (PRD §3.10). */
export default function BodyRecordsPage() {
  const data = useBodyData();
  const [editing, setEditing] = useState<BodySession | null>(null);
  const [heightOpen, setHeightOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-3.5 pb-8">
      <PageHeader title="Все записи" backHref="/body/" />
      {data && (
        <>
          <div className="mx-4 flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface">
            {data.sessions.map((s) => {
              const n = enteredCount(s);
              const note = `${n} ${plural(n, ["значение", "значения", "значений"])}`;
              return (
                <button
                  key={s.date}
                  type="button"
                  onClick={() => setEditing(s)}
                  aria-label={`Замер ${fullDate(s.date)}, ${note}: изменить или удалить`}
                  className="flex min-h-[52px] items-center gap-2.5 border-t border-line px-3.5 text-left first:border-t-0"
                >
                  <span className="flex-1 font-mono text-sm font-bold">{fullDate(s.date)}</span>
                  <span className="text-[13px] text-ink-muted">{note}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              );
            })}
          </div>
          {data.sessions.length === 0 && <p className="px-5 text-[15px] text-ink-muted">Замеров пока нет.</p>}
          <MeasurementSheet
            open={editing !== null}
            onClose={() => setEditing(null)}
            types={data.types}
            sessions={data.sessions}
            session={editing}
            heightCm={data.height}
            onAskHeight={() => setHeightOpen(true)}
          />
          {heightOpen && <HeightSheet open onClose={() => setHeightOpen(false)} current={data.height} />}
        </>
      )}
    </div>
  );
}
