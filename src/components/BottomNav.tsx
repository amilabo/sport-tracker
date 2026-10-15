"use client";

import Link from "next/link";

const TABS = [
  {
    href: "/",
    label: "Тренировки",
    icon: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  },
  {
    href: "/history/",
    label: "История",
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    href: "/body/",
    label: "Тело",
    icon: (
      <>
        <circle cx="12" cy="5" r="2.2" />
        <path d="M12 8v7M7 11h10M12 15l-3 6M12 15l3 6" />
      </>
    ),
  },
  {
    href: "/more/",
    label: "Ещё",
    icon: (
      <>
        <circle cx="5" cy="12" r="1.6" fill="currentColor" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <circle cx="19" cy="12" r="1.6" fill="currentColor" />
      </>
    ),
  },
];

export const TAB_ROOTS = TABS.map((t) => t.href);

export function BottomNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Разделы"
      className="pb-safe sticky bottom-0 z-20 grid grid-cols-4 bg-surface-inverse px-2 pt-2"
    >
      {TABS.map((tab) => {
        const on = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center gap-1 py-2 text-xs transition-colors ${
              on ? "font-semibold text-accent" : "text-on-inverse-muted"
            }`}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {tab.icon}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
