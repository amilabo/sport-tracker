"use client";

import { usePathname } from "next/navigation";
import { IS_ANDROID } from "@/platform";
import { AndroidBoot } from "./AndroidBoot";
import { BottomNav, TAB_ROOTS } from "./BottomNav";
import { DbBoot } from "./DbBoot";
import { DemoBanner } from "./DemoBanner";
import { PwaBoot } from "./PwaBoot";

function normalize(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}

/** Mobile column with the bottom tab bar on the four top-level sections. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = normalize(usePathname() ?? "/");
  const tab = TAB_ROOTS.find((root) => root === path);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg pt-[var(--safe-top)]">
      {/* APK: the page runs under the transparent status bar; this strip keeps scrolled content off its icons. */}
      {IS_ANDROID && <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[var(--safe-top)] bg-bg" />}
      <DbBoot />
      <DemoBanner />
      {IS_ANDROID ? <AndroidBoot /> : <PwaBoot />}
      <main className="flex flex-1 flex-col">{children}</main>
      {tab && <BottomNav active={tab} />}
    </div>
  );
}
