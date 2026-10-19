"use client";

import Link from "next/link";
import { useLive } from "@/db/hooks";
import { demoRepo } from "@/db/repos/demo";

/** While demo data is loaded, a strip on top of every screen says so (PRD §3.12). */
export function DemoBanner() {
  const { data: loaded } = useLive(() => demoRepo.isLoaded(), [], ["workouts", "measurements"]);
  if (!loaded) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-surface-inverse px-4 py-2 text-[13px] text-on-inverse">
      <span>
        <b className="font-semibold">Демо-данные</b> · примеры тренировок и замеров
      </span>
      <Link href="/more/#demo" className="min-h-11 content-center font-semibold text-accent-on-inverse underline underline-offset-2">
        Удалить
      </Link>
    </div>
  );
}
