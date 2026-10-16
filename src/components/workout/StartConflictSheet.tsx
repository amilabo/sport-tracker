"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatTime } from "@/domain/format";
import type { Workout } from "@/domain/types";

/** Only one workout may be in progress (PRD §3.13): continue it, or finish it and start the new one. */
export function StartConflictSheet({
  active,
  onClose,
  onFinishAndStart,
}: {
  active: Workout | null;
  onClose: () => void;
  onFinishAndStart: () => void;
}) {
  return (
    <Sheet
      open={active !== null}
      onClose={onClose}
      title="Уже идёт тренировка"
      footer={
        <div className="flex flex-col gap-2">
          <ButtonLink href={active ? `/workout/?id=${active.id}` : "/workout/"} variant="primary" onClick={onClose}>
            Продолжить текущую
          </ButtonLink>
          <Button variant="outline" onClick={onFinishAndStart}>
            Завершить её и начать новую
          </Button>
        </div>
      }
    >
      <p className="text-[15px]">
        Тренировка начата в {active ? formatTime(active.started_at) : ""}. Одновременно может идти только одна. Продолжить её или завершить и
        начать новую?
      </p>
    </Sheet>
  );
}
