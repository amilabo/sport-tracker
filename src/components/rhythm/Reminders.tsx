"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { settingsRepo } from "@/db/repos/settings";
import { plural } from "@/domain/format";
import { planReminders, sortedDays, suggestDays, WEEKDAYS_SHORT, type ReminderInput, type ReminderKind, type ReminderSettings, type Weekday } from "@/domain/reminders";
import { GOAL_MAX, goalWord } from "@/domain/rhythm";
import { useNotifyPermission } from "@/lib/rest-alarm";
import { useReminderSettings } from "@/lib/reminder-settings";
import { getPlatform } from "@/platform";

const LETTERS = ["П", "В", "С", "Ч", "П", "С", "В"];
const NAMES = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const DAY_FORMS: [string, string, string] = ["день", "дня", "дней"];
const TITLES: Record<ReminderKind, string> = { weekly: "План на неделю", tomorrow: "Завтра тренировка", goal: "Цель недели" };
/** When the sheet has nothing to show yet (the goal is reached, no days): the texts of mockup Н3. */
const SAMPLES: Record<ReminderKind, { title: string; text: string }> = {
  weekly: { title: "Неделя 3–9 ноября: 2 тренировки", text: "Вт — Ноги / грудь / руки\nЧт — Ягодицы / спина" },
  tomorrow: { title: "Завтра тренировка", text: "Ноги / грудь / руки · 10 упражнений" },
  goal: { title: "Неделя ещё может сложиться", text: "Пока 0 из 2, до конца недели 3 дня. Следующая — Ноги / грудь / руки" },
};

const chip = (on: boolean) =>
  `h-11 rounded-xl text-[15px] font-bold transition-colors ${on ? "bg-selected text-on-selected" : "border-[1.5px] border-line"}`;

type Data = Omit<ReminderInput, "settings" | "now"> & { habit: { top: boolean }[] };

/**
 * APK A6, mockup Н1: «Напоминания» on «Ритм», right under «Цель» — the training days (suggested once from the last
 * 8 weeks) and three reminders, each a row like Android's settings: the name and time open the sheet (Н2), the switch
 * after the line turns it on. The first switch asks Android for notifications.
 */
export function RhythmReminders({ data }: { data: Data }) {
  const [settings, save] = useReminderSettings();
  const [perm, setPerm] = useNotifyPermission();
  const [editing, setEditing] = useState<ReminderKind | null>(null);

  // The habitual days are marked once, when the block is first seen; after that only the person changes them.
  const suggestion = suggestDays(data.habit);
  useEffect(() => {
    if (settings && settings.days === null && suggestion.length) save({ ...settings, days: suggestion, suggested: true });
  }, [settings, suggestion, save]);

  if (!settings) return null;
  const days = sortedDays(settings.days);
  const noDays = days.length === 0;
  const goal = data.goal;

  const toggleDay = (d: Weekday) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    save({ ...settings, days: sortedDays(next), suggested: false });
  };

  const toggle = async (kind: ReminderKind) => {
    const on = !settings[kind].on;
    save({ ...settings, [kind]: { ...settings[kind], on } });
    if (on && perm === "prompt") {
      const p = await getPlatform();
      setPerm(await p.notifications.request().catch(() => "denied" as const));
    }
  };

  const rows: { kind: ReminderKind; time: string; sub: string; disabled: boolean }[] = [
    {
      kind: "weekly",
      time: `${WEEKDAYS_SHORT[settings.weekly.day]}, ${settings.weekly.time}`,
      sub: noDays ? "Сначала выберите дни" : "Какие планы в какие дни",
      disabled: noDays,
    },
    {
      kind: "tomorrow",
      time: `накануне, ${settings.tomorrow.time}`,
      sub: noDays ? "Сначала выберите дни" : `Какой план завтра · дни: ${days.map((d) => WEEKDAYS_SHORT[d]).join(", ")}`,
      disabled: noDays,
    },
    {
      kind: "goal",
      time: settings.goal.time,
      sub: goal === null ? "Сначала задайте цель" : "Если неделя может пройти мимо цели",
      disabled: goal === null,
    },
  ];
  const anyOn = rows.some((r) => settings[r.kind].on && !r.disabled);

  return (
    <section aria-labelledby="rem-h" className="flex flex-col gap-2.5">
      <h2 id="rem-h" className="font-display text-xs font-bold tracking-[0.04em] uppercase">
        Напоминания
      </h2>

      {perm === "denied" && anyOn && (
        <div className="flex flex-col items-start gap-2 rounded-2xl border-[1.5px] border-danger bg-surface px-3.5 py-3">
          <span className="text-sm leading-snug">Уведомления выключены в настройках телефона. Напоминания не придут.</span>
          <Button variant="outline" size="md" onClick={() => getPlatform().then((p) => p.notifications.openSettings())}>
            Открыть настройки
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-line bg-surface p-3.5">
        <span className="text-base font-semibold">Дни тренировок</span>
        <div role="group" aria-label="Дни тренировок" className="grid grid-cols-7 gap-1.5">
          {LETTERS.map((l, i) => (
            <button key={i} type="button" aria-pressed={days.includes(i as Weekday)} aria-label={NAMES[i]} onClick={() => toggleDay(i as Weekday)} className={chip(days.includes(i as Weekday))}>
              {l}
            </button>
          ))}
        </div>
        {settings.suggested && !noDays && <span className="text-[13px] leading-snug text-ink-muted">Отметили по вашим тренировкам за 8 недель — поправьте под себя.</span>}
        {goal !== null && !noDays && days.length !== goal && (
          <div className="flex items-center gap-2.5 pt-0.5">
            <span className="flex-1 text-[13px] leading-snug text-ink-muted">
              Выбрано {days.length} {plural(days.length, DAY_FORMS)}, а цель — {goal} {goalWord(goal)} в неделю.
            </span>
            {days.length <= GOAL_MAX && (
              <Button variant="outline" size="md" className="shrink-0 text-[13px]" onClick={() => settingsRepo.update({ weekly_goal: days.length })}>
                Цель — {days.length}
              </Button>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface">
        {rows.map((r) => {
          const on = settings[r.kind].on && !r.disabled;
          return (
            <li key={r.kind} className="flex items-stretch border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => setEditing(r.kind)}
                aria-label={`${TITLES[r.kind]}: день и время`}
                className={`flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-[3px] px-3.5 py-3 text-left ${r.disabled ? "text-ink-muted" : ""}`}
              >
                <span className="text-base font-semibold">{TITLES[r.kind]}</span>
                <span className="font-mono text-sm font-bold">{r.time}</span>
                <span className="text-[13px] leading-snug text-ink-muted">{r.sub}</span>
              </button>
              <span aria-hidden="true" className="h-10 w-[1.5px] shrink-0 self-center bg-line" />
              <span className="flex shrink-0 items-center px-3.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={TITLES[r.kind]}
                  aria-disabled={r.disabled}
                  onClick={() => !r.disabled && toggle(r.kind)}
                  className={`flex h-8 w-[52px] rounded-full p-[3px] transition-colors ${on ? "justify-end bg-accent" : "justify-start bg-line-strong"} ${r.disabled ? "opacity-50" : ""}`}
                >
                  <span className="block h-[26px] w-[26px] rounded-full bg-surface" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <span className="text-[13px] leading-snug text-ink-muted">
        Нажмите на строку, чтобы выбрать день и время. Напоминания работают без интернета, настройки хранятся только на этом телефоне.
      </span>

      <TimeSheet kind={editing} settings={settings} data={data} onSave={save} onClose={() => setEditing(null)} />
    </section>
  );
}

/** Mockup Н2: the day (only «План на неделю»), the time (Android's own picker) and the notification as it will come. */
function TimeSheet({ kind, settings, data, onSave, onClose }: { kind: ReminderKind | null; settings: ReminderSettings; data: Data; onSave: (s: ReminderSettings) => void; onClose: () => void }) {
  const current = kind ? settings[kind] : null;
  const [day, setDay] = useState<Weekday>(settings.weekly.day);
  const [time, setTime] = useState("20:00");
  const [shownFor, setShownFor] = useState<ReminderKind | null>(null);
  if (kind !== shownFor) {
    setShownFor(kind);
    setDay(settings.weekly.day);
    if (current) setTime(current.time);
  }

  const draft: ReminderSettings | null = kind
    ? {
        ...settings,
        weekly: { ...settings.weekly, on: kind === "weekly", ...(kind === "weekly" ? { day, time } : {}) },
        tomorrow: { ...settings.tomorrow, on: kind === "tomorrow", ...(kind === "tomorrow" ? { time } : {}) },
        goal: { ...settings.goal, on: kind === "goal", ...(kind === "goal" ? { time } : {}) },
      }
    : null;
  const first = draft ? planReminders({ ...data, settings: draft, now: new Date() }).find((r) => r.kind === kind) : undefined;
  const shown = first ?? (kind ? SAMPLES[kind] : null);
  const when = first ? `${WEEKDAYS_SHORT[(new Date(first.at).getDay() + 6) % 7]} ${time}` : kind === "weekly" ? `${WEEKDAYS_SHORT[day]} ${time}` : time;

  const done = () => {
    if (!kind || !/^\d{2}:\d{2}$/.test(time)) return onClose();
    onSave({ ...settings, [kind]: { ...settings[kind], time, ...(kind === "weekly" ? { day } : {}) } });
    onClose();
  };

  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={kind ? TITLES[kind] : ""}
      footer={
        <Button variant="primary" size="xl" className="w-full" onClick={done}>
          Готово
        </Button>
      }
    >
      <div className="flex flex-col gap-[18px]">
        {kind === "weekly" && (
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">День</span>
            <div role="radiogroup" aria-label="День" className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS_SHORT.map((l, i) => (
                <button key={l} type="button" role="radio" aria-checked={day === i} onClick={() => setDay(i as Weekday)} className={`text-sm ${chip(day === i)}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Время</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-15 rounded-[14px] border-[1.5px] border-ink bg-surface px-4 font-mono text-2xl font-bold text-ink"
          />
        </label>
        {shown && (
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">{first ? "Так придёт" : "Так будет выглядеть"}</span>
            <div className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-line bg-surface-raised px-3.5 py-3">
              <span className="text-xs text-ink-muted">На подходе · {when}</span>
              <span className="text-[15px] leading-snug font-bold">{shown.title}</span>
              <span className="text-sm leading-normal whitespace-pre-line text-ink-muted">{shown.text}</span>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
