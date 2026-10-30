"use client";

import { useEffect, useState } from "react";

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: "release", cb: () => void) => void };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

/**
 * Keeps the screen on while `active` (a workout with rest, stage 35): a locked phone cannot play the
 * end-of-rest signal. The browser drops the lock when the page is hidden, so it is asked again on return.
 * Returns whether the lock is held — the rest panel says «экран не гаснет».
 */
export function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!active || !api) return;
    let sentinel: Sentinel | null = null;
    let alive = true;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const s = await api.request("screen");
        if (!alive) return void s.release();
        sentinel = s;
        setHeld(true);
        s.addEventListener("release", () => alive && setHeld(false));
      } catch {
        // Battery saver or a denied permission: the screen goes off as usual.
        setHeld(false);
      }
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", acquire);
      sentinel?.release().catch(() => {});
      setHeld(false);
    };
  }, [active]);

  return held;
}
