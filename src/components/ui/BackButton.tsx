"use client";

import { useRouter } from "next/navigation";

/** Goes back in history when the app has history, otherwise to the fallback page (e.g. opened by a link). */
export function BackButton({ fallback, label = "Назад" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-ink"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
