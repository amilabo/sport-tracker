"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormError } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { settingsRepo } from "@/db/repos/settings";
import { parseDecimal } from "@/domain/format";

/** Height for BMI (PRD §3.10): set once, can be changed. */
export function HeightSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: number | null }) {
  const [text, setText] = useState(current ? String(current) : "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const v = parseDecimal(text);
    if (v === null || v < 100 || v > 250) return setError("Рост в сантиметрах, от 100 до 250");
    await settingsRepo.update({ height_cm: Math.round(v) });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Рост"
      footer={
        <Button variant="primary" className="w-full" onClick={save}>
          Сохранить
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Рост, см" inputMode="numeric" value={text} onChange={(e) => (setText(e.target.value), setError(null))} placeholder="170" />
        <p className="text-[13px] leading-snug text-ink-muted">Нужен, чтобы считать ИМТ по весу. ИМТ пересчитается для всех замеров.</p>
        <FormError message={error} />
      </div>
    </Sheet>
  );
}
