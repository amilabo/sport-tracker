"use client";

import { useTheme } from "@/components/ThemeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { accentFits, ACCENTS, themeInfo, THEMES, type ModePref } from "@/lib/theme";

const MODES: { id: ModePref; label: string }[] = [
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
  { id: "system", label: "Как в системе" },
];

const sectionTitle = "font-display text-xs font-bold tracking-[0.04em] uppercase";

/** A miniature of the app drawn with the theme's own tokens: the preview is instant and needs no colors in code. */
function ThemePreview({ theme, accent, mode }: { theme: string; accent: string; mode: "light" | "dark" }) {
  return (
    <div data-theme={theme} data-accent={accent} data-mode={mode} className="flex flex-col gap-1.5 rounded-xl bg-bg p-2.5" aria-hidden="true">
      <div className="flex items-center justify-between rounded-lg bg-surface-inverse px-2 py-1.5">
        <span className="h-1.5 w-10 rounded-full bg-on-inverse" />
        <span className="h-3 w-8 rounded bg-accent" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-2 py-1.5">
        <span className="h-1.5 w-12 rounded-full bg-ink" />
        <span className="h-4 w-4 rounded-full bg-accent" />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-line bg-surface-done px-2 py-1.5">
        <span className="h-1.5 w-9 rounded-full bg-ink-muted" />
        <span className="h-4 w-4 rounded-full border-2 border-line-strong" />
      </div>
    </div>
  );
}

const CHECK = "M5 12l5 5 9-10";

/** The «Тело» screen in miniature: everything the accent paints — button, ✓, chart, link, active tab. */
function AccentPreview() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-bg">
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[22px] font-extrabold tracking-[-0.02em]">Тело</span>
          <span className="flex h-8 items-center rounded-[10px] bg-accent px-3 text-[13px] font-bold text-on-accent">+ Замер</span>
        </div>
        <div className="flex items-center justify-between rounded-[14px] bg-surface-inverse p-3 text-on-inverse">
          <span className="flex flex-col gap-1">
            <span className="text-xs text-on-inverse-muted">Вес</span>
            <span className="font-display text-[28px] leading-none font-extrabold">
              64,5<span className="ml-1 font-sans text-[13px] font-semibold">кг</span>
            </span>
          </span>
          <svg width="140" height="48" viewBox="0 0 140 48" className="text-chart-line">
            <polyline points="6,32 28,35 50,24 72,44 94,40 116,26 134,33" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="134" cy="33" r="4.5" fill="currentColor" />
          </svg>
        </div>
        <span className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-done px-3 py-2.5">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={CHECK} />
            </svg>
          </span>
          <span className="flex-1 text-sm font-semibold">Жим ногами</span>
          <span className="font-mono text-xs text-ink-muted">4 × 12 × 40</span>
        </span>
        <span className="text-[13px] font-semibold text-accent-text underline underline-offset-[3px]">Изменить рост</span>
      </div>
      <div className="grid grid-cols-4 bg-surface-inverse px-1 pt-2 pb-3 text-center text-[11px] text-on-inverse-muted">
        <span>Тренировки</span>
        <span>История</span>
        <span className="font-bold text-accent-on-inverse">Тело</span>
        <span>Ещё</span>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const { theme, accent, modePref, mode, setTheme, setAccent, setModePref } = useTheme();
  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  const unfit = ACCENTS.filter((a) => !accentFits(theme, a.id));

  return (
    <div className="flex flex-1 flex-col gap-5 pb-8">
      <PageHeader title="Оформление" backHref="/more/" />

      <section className="flex flex-col gap-2.5 px-4">
        <h2 className={sectionTitle}>Режим</h2>
        <div role="radiogroup" aria-label="Режим" className="grid grid-cols-[1fr_1fr_1.35fr] gap-1.5 rounded-2xl border-[1.5px] border-ink p-1">
          {MODES.map((m) => {
            const on = m.id === modePref;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setModePref(m.id)}
                className={`min-h-11 rounded-xl px-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  on ? "bg-surface-inverse text-on-inverse" : "text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* With one theme there is nothing to choose: the list shows from two. */}
      {THEMES.length > 1 && (
        <section className="flex flex-col gap-2.5 px-4">
          <h2 className={sectionTitle}>Цветовая тема</h2>
          <div role="radiogroup" aria-label="Цветовая тема" className="flex flex-col gap-2.5">
            {THEMES.map((t) => {
              const on = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(t.id)}
                  className={`grid grid-cols-[1fr_120px] items-center gap-3 rounded-[18px] border-2 bg-surface p-3 text-left transition-colors ${
                    on ? "border-accent-line" : "border-line"
                  }`}
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{t.name}</span>
                    <span className="text-[13px] text-ink-muted">{t.description}</span>
                  </span>
                  {/* Choosing a theme switches to its own accent, so that is what the preview shows. */}
                  <ThemePreview theme={t.id} accent={t.defaultAccent} mode={mode} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2.5 px-4">
        <div className="flex items-baseline justify-between">
          <h2 className={sectionTitle}>Акцент</h2>
          <span className="text-[13px] text-ink-muted">{current.name}</span>
        </div>
        <div role="radiogroup" aria-label="Акцентный цвет" className="grid grid-cols-3 gap-1.5">
          {ACCENTS.map((a) => {
            const on = a.id === accent;
            const fits = accentFits(theme, a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!fits}
                aria-describedby={fits ? undefined : "accent-unfit"}
                onClick={() => setAccent(a.id)}
                className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] px-0.5 py-2 transition-colors ${
                  on ? "border-ink bg-surface-raised" : fits ? "border-line bg-surface" : "border-dashed border-line-strong bg-bg text-ink-muted"
                }`}
              >
                {/* The swatch carries its own accent attributes, so it shows that accent's --accent. */}
                <span
                  aria-hidden="true"
                  data-accent={a.id}
                  data-mode={mode}
                  className={`flex h-9 w-9 items-center justify-center rounded-full bg-accent text-on-accent ${fits ? "" : "opacity-30"}`}
                >
                  {on && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={CHECK} />
                    </svg>
                  )}
                </span>
                <span className="text-xs font-semibold">{a.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[13px] leading-snug text-ink-muted">Фон и текст темы остаются. Меняются кнопки, отметки, графики и активная вкладка.</p>
        {unfit.length > 0 && (
          <p id="accent-unfit" className="text-[13px] leading-snug text-ink-muted">
            К теме «{themeInfo(theme).name}» не подходят: {unfit.map((a) => a.name).join(", ")} — на светлых плашках их не видно.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2.5 px-4">
        <h2 className={sectionTitle}>Как будет выглядеть</h2>
        <AccentPreview />
      </section>
    </div>
  );
}
