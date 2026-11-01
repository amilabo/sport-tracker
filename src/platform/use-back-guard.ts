"use client";

import { useEffect } from "react";
import { pushBackGuard } from "./back";

/** While `onBack` is set, the Android back button calls it instead of leaving the screen (pass a stable callback). */
export function useBackGuard(onBack: (() => void) | null) {
  useEffect(() => (onBack ? pushBackGuard(onBack) : undefined), [onBack]);
}
