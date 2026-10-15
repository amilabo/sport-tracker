"use client";

import { usePathname } from "next/navigation";
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg">
      <DbBoot />
      <DemoBanner />
      <PwaBoot />
      <main className="flex flex-1 flex-col">{children}</main>
      {tab && <BottomNav active={tab} />}
    </div>
  );
}
