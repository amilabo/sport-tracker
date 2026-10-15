"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useLive } from "@/db/hooks";
import { settingsRepo } from "@/db/repos/settings";
import { detectPlatform, installPrompt, isStandalone, type Platform } from "@/lib/pwa";

const noop = () => () => {};

/**
 * «Добавьте на экран Домой» (PRD §3.12). On iPhone this matters most: Safari may erase data of a site
 * not opened for about 7 days, an app on the home screen keeps it. Hidden once dismissed or installed.
 */
export function InstallHint() {
  // Server render and the first client render agree on "hidden"; the real values arrive right after.
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const platform = useSyncExternalStore<Platform | null>(noop, detectPlatform, () => null);
  const prompt = useSyncExternalStore(installPrompt.subscribe, installPrompt.get, () => null);
  const { data: settings } = useLive(() => settingsRepo.get(), [], ["settings"]);

  if (standalone || !platform || !settings || settings.install_hint_dismissed) return null;
  // On a computer the hint only makes sense when the browser can install the app.
  if (platform === "other" && !prompt) return null;

  const dismiss = () => settingsRepo.update({ install_hint_dismissed: true });

  return (
    <section aria-label="Установка" className="flex flex-col gap-2.5 rounded-[18px] border-2 border-dashed border-ink bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-[17px] leading-tight font-bold">Добавьте на экран «Домой»</h2>
        <button type="button" onClick={dismiss} aria-label="Скрыть подсказку" className="-mt-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {platform === "ios" ? (
        <>
          <p className="text-[15px] leading-snug">
            В Safari нажмите «Поделиться»{" "}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -translate-y-0.5" aria-label="значок «Поделиться»">
              <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
            </svg>{" "}
            → «На экран „Домой“».
          </p>
          <p className="text-[13px] leading-snug text-ink-muted">
            Так приложение открывается без браузера и работает без интернета, а iPhone не сотрёт записи, если долго не заходить.
          </p>
        </>
      ) : prompt ? (
        <>
          <p className="text-[13px] leading-snug text-ink-muted">Приложение будет открываться с иконки и работать без интернета.</p>
          <Button variant="primary" className="w-full" onClick={() => installPrompt.show()}>
            Установить
          </Button>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-snug">Откройте меню браузера ⋮ → «Добавить на главный экран».</p>
          <p className="text-[13px] leading-snug text-ink-muted">Приложение будет открываться с иконки и работать без интернета.</p>
        </>
      )}
    </section>
  );
}
