"use client";

import { useSyncExternalStore } from "react";
import { formatHeaderDate } from "@/domain/format";

const noopSubscribe = () => () => {};

/** Today's date, rendered on the client only (the static HTML is built on another day). */
export function TodayLabel() {
  const label = useSyncExternalStore(
    noopSubscribe,
    () => formatHeaderDate(new Date()),
    () => " ",
  );
  return <>{label}</>;
}
