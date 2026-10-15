"use client";

import { useTheme } from "@/components/ThemeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { THEMES, type ModePref } from "@/lib/theme";

const MODES: { id: ModePref; label: string }[] = [
  { id: "light", label: "Светлая" },
  { id: "dark", label: "Тёмная" },
  { id: "system", label: "Как в системе" },
];

/** A miniature of the app drawn with the theme's own tokens: the preview is instant and needs no colors in code. */
function ThemePreview({ theme, mode }: { theme: string; mode: "light" | "dark" }) {
  return (
    <div data-theme={theme} data-mode={mode} className="flex flex-col gap-1.5 rounded-xl bg-bg p-2.5" aria-hidden="true">
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

export default function AppearancePage() {
  const { theme, modePref, mode, setTheme, setModePref } = useTheme();

  return (
    <div className="flex flex-1 flex-col gap-5 pb-8">
      <PageHeader title="Оформление" backHref="/more/" />

      <section className="flex flex-col gap-2.5 px-4">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Режим</h2>
        <div role="radiogroup" aria-label="Режим" className="grid grid-cols-3 gap-1.5 rounded-2xl border-[1.5px] border-ink p-1">
          {MODES.map((m) => {
            const on = m.id === modePref;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setModePref(m.id)}
                className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition-colors ${
                  on ? "bg-surface-inverse text-on-inverse" : "text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 px-4">
        <h2 className="font-display text-xs font-bold tracking-[0.04em] uppercase">Цветовая тема</h2>
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
                  on ? "border-accent" : "border-line"
                }`}
              >
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{t.name}</span>
                  <span className="text-[13px] text-ink-muted">{t.description}</span>
                </span>
                <ThemePreview theme={t.id} mode={mode} />
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-ink-muted">Новые палитры появятся позже.</p>
      </section>
    </div>
  );
}
