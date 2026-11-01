"use client";

import { useEffect } from "react";
import { getPlatform } from "@/platform";

/** APK only (instead of PwaBoot): the back button and the launch screen. */
export function AndroidBoot() {
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    getPlatform().then((p) => {
      if (alive) stop = p.start();
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, []);
  return null;
}
