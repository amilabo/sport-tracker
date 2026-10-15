"use client";

import { useEffect, useState } from "react";
import { BASE_PATH, initInstallPrompt } from "@/lib/pwa";

const UPDATED_KEY = "st-updated";

/**
 * Registers the service worker (production build only) and applies updates at startup:
 * a version downloaded during the previous session is activated on the next launch, then a short toast says so.
 */
export function PwaBoot() {
  const [toast, setToast] = useState(false);

  useEffect(() => {
    initInstallPrompt();

    let updated = false;
    try {
      updated = sessionStorage.getItem(UPDATED_KEY) === "1";
      sessionStorage.removeItem(UPDATED_KEY);
    } catch {
      // storage unavailable: no toast, the update itself still works
    }
    let hide: ReturnType<typeof setTimeout> | undefined;
    if (updated) {
      Promise.resolve().then(() => setToast(true));
      hide = setTimeout(() => setToast(false), 3500);
    }

    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return () => clearTimeout(hide);

    const sw = navigator.serviceWorker;
    // The very first install also takes control of the page; that is not an update, so no reload then.
    const hadController = !!sw.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      try {
        sessionStorage.setItem(UPDATED_KEY, "1");
      } catch {
        // ignore
      }
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    let onVisible: (() => void) | undefined;
    sw.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .then((reg) => {
        // A new version is already downloaded and waiting: switch to it now, right after launch.
        if (reg.waiting && hadController) reg.waiting.postMessage("SKIP_WAITING");
        // Look for a new version whenever the app comes back to the screen; it applies on the next launch.
        onVisible = () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch((err) => console.error("Service worker registration failed", err));

    return () => {
      clearTimeout(hide);
      sw.removeEventListener("controllerchange", onControllerChange);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 mx-auto w-fit rounded-full bg-surface-inverse px-4 py-2.5 text-sm font-semibold text-on-inverse"
    >
      Приложение обновлено
    </div>
  );
}
