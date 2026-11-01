"use client";

import { onChange } from "@/db/events";
import { plansRepo } from "@/db/repos/plans";
import { settingsRepo } from "@/db/repos/settings";
import { workoutsRepo } from "@/db/repos/workouts";
import { planQueue, planReminders } from "@/domain/reminders";
import { dayKey, doneByDay, weekStart } from "@/domain/rhythm";
import type { StoreName } from "@/domain/types";
import { getPlatform } from "@/platform";
import type { HomeData } from "@/platform/types";
import { tokenHex } from "./css-color";
import { onRemindersChange, readReminders } from "./reminder-settings";

const STORES: StoreName[] = ["plans", "plan_exercises", "workouts", "settings"];

/** The widget colors from the theme on screen (mockups В1–В3): the plate is --surface, «Следующая» --surface-inverse. */
function widgetColors(): Record<string, string> {
  const pick: Record<string, string> = {
    surface: "--surface",
    ink: "--ink",
    muted: "--ink-muted",
    line: "--line-strong",
    panel: "--surface-inverse",
    panelInk: "--on-inverse",
    panelMuted: "--on-inverse-muted",
    accent: "--accent",
    onAccent: "--on-accent",
  };
  const out: Record<string, string> = {};
  for (const [name, token] of Object.entries(pick)) {
    const hex = tokenHex(token);
    if (hex) out[name] = hex;
  }
  return out;
}

/** What the phone shows outside the app: the reminders (A6), the widgets (A7), the workout shortcut (A8). */
async function collect() {
  const [plans, counts, completed, active, settings] = await Promise.all([
    plansRepo.list(),
    plansRepo.exerciseCounts(),
    workoutsRepo.listCompleted(),
    workoutsRepo.getActive(),
    settingsRepo.get(),
  ]);
  const now = new Date();
  const goal = typeof settings.weekly_goal === "number" ? settings.weekly_goal : null;
  const reminders = planReminders({ plans, exerciseCounts: counts, workouts: completed, goal, settings: readReminders(), now });

  const done = doneByDay(completed);
  const monday = weekStart(now);
  const doneDays: number[] = [];
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const n = done.get(dayKey(d)) ?? 0;
    if (n) doneDays.push(i);
    count += n;
  }
  const last = completed.reduce<string | null>((max, w) => (!max || w.started_at > max ? w.started_at : max), null);
  const next = planQueue(plans, completed, 1)[0] ?? null;
  const activePlan = active?.plan_id ? plans.find((p) => p.id === active.plan_id) : undefined;

  const home: HomeData = {
    widgets: {
      week: dayKey(monday),
      doneDays,
      count,
      goal,
      last: last ? dayKey(new Date(last)) : null,
      next: next ? { id: next.id, name: next.name } : null,
      colors: widgetColors(),
    },
    shortcut: active
      ? { label: activePlan ? `Продолжить: ${activePlan.name}` : "Продолжить тренировку", path: `/workout/?id=${active.id}` }
      : next
        ? { label: next.name, path: `/workout/?plan=${next.id}` }
        : { label: "Тренировки", path: "/" },
  };
  return { reminders, home };
}

/**
 * APK: keeps the reminders, widgets and shortcut in step with the data — on start, on every change of plans, workouts
 * or the goal, of the reminder settings and of the theme, and on every return to the app. Only changes are sent.
 */
export function startHomeSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastReminders = "";
  let lastHome = "";
  let alive = true;

  const run = async () => {
    try {
      const { reminders, home } = await collect();
      if (!alive) return;
      const p = await getPlatform();
      const r = JSON.stringify(reminders);
      if (r !== lastReminders) {
        lastReminders = r;
        await p.reminders.set(reminders);
      }
      const h = JSON.stringify(home);
      if (h !== lastHome) {
        lastHome = h;
        await p.home.update(home);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  };

  soon();
  const offDb = onChange((changed) => {
    if (STORES.some((s) => changed.has(s))) soon();
  });
  const offReminders = onRemindersChange(soon);
  const theme = new MutationObserver(soon);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode", "data-accent"] });
  const onVisible = () => document.visibilityState === "visible" && soon();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    alive = false;
    clearTimeout(timer);
    offDb();
    offReminders();
    theme.disconnect();
    document.removeEventListener("visibilitychange", onVisible);
  };
}
