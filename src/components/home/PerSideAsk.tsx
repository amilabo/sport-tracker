"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { exercisesRepo } from "@/db/repos/exercises";
import { plansRepo } from "@/db/repos/plans";
import { workoutsRepo } from "@/db/repos/workouts";
import { perSideCandidates, perSideWhy, type PerSideCandidate } from "@/domain/per-side-candidates";
import type { Id } from "@/domain/types";

// Once per device (not in the backup): the question is about the update, a restored copy needs no new one.
const ASKED_KEY = "per-side-asked";

function asked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Storage blocked: the sheet may show again — harmless.
  }
}

/**
 * «На каждую сторону?» (stage 53, mockup Р6): once after the update, on the home screen — only with workouts done,
 * exercises in plans to ask about, and nothing else going on (`blocked`: a workout in progress, the plan question).
 */
export function PerSideAsk({ blocked }: { blocked: boolean }) {
  const [list, setList] = useState<PerSideCandidate[] | null>(null);
  const [checked, setChecked] = useState<Set<Id>>(new Set());
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (asked()) return;
    let alive = true;
    (async () => {
      if ((await workoutsRepo.listCompleted()).length === 0) return;
      const plans = await plansRepo.list();
      const full = await Promise.all(plans.map((p) => plansRepo.getFull(p.id)));
      const lines = full.flatMap((f) => (f ? f.items.map((i) => ({ exercise: i.exercise, note: i.planExercise.note, reps: i.sets.map((s) => s.reps) })) : []));
      const candidates = perSideCandidates(lines.filter((l) => !l.exercise.archived_at));
      if (!alive || candidates.length === 0) return;
      setList(candidates);
      setChecked(new Set(candidates.filter((c) => c.checked).map((c) => c.exercise.id)));
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function done(save: boolean) {
    setBusy(true);
    try {
      if (save && list) {
        for (const c of list) {
          const on = checked.has(c.exercise.id);
          if (on !== (c.exercise.per_side === true)) await exercisesRepo.setProgress(c.exercise.id, { per_side: on });
        }
      }
    } finally {
      markAsked();
      setClosed(true);
      setBusy(false);
    }
  }

  if (!list) return null;
  // Waits while something else is on the screen; once answered or closed — never again.
  const open = !blocked && !closed;
  return (
    <Sheet
      open={open}
      onClose={() => done(false)}
      title="На каждую сторону?"
      footer={
        <Button variant="primary" className="w-full" onClick={() => done(true)} disabled={busy}>
          Готово
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[15px] leading-snug">
          Теперь приложение умеет прибавлять повторы. Отметьте упражнения, которые делаете на каждую ногу или руку отдельно, — потолок и +1 будут считаться на
          сторону.
        </p>
        <p className="text-[13px] leading-snug text-ink-muted">В планах и истории ничего не пересчитывается: 20 так и останется 20 (по 10).</p>
        <ul className="flex flex-col">
          {list.map((c) => {
            const on = checked.has(c.exercise.id);
            return (
              <li key={c.exercise.id} className="border-t border-line">
                <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev);
                        if (on) next.delete(c.exercise.id);
                        else next.add(c.exercise.id);
                        return next;
                      })
                    }
                    className="h-6 w-6 shrink-0 accent-[var(--ink)]"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] leading-tight font-semibold">{c.exercise.name}</span>
                    <span className="text-[13px] text-ink-muted">{perSideWhy(c)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] leading-snug text-ink-muted">В списке — только упражнения из ваших планов. Позже — на экране упражнения, «Как прибавлять».</p>
      </div>
    </Sheet>
  );
}
