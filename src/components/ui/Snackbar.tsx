"use client";

import { useEffect } from "react";

interface SnackbarProps {
  /** null — hidden. A new message (or the same text again) restarts the timer. */
  message: string | null;
  /** Buttons on the right: «Отменить», «Запомнить замену». */
  actions?: React.ReactNode;
  onClose: () => void;
  /** Hides itself after this long. */
  ms?: number;
  /** Changes when the same text must be shown anew. */
  token?: unknown;
}

/** A short message over the bottom edge with an action or two — after a change that can still be undone. */
export function Snackbar({ message, actions, onClose, ms = 8000, token }: SnackbarProps) {
  useEffect(() => {
    if (message === null) return;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [message, ms, onClose, token]);

  if (message === null) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[480px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        className="pointer-events-auto snackbar flex w-full flex-col gap-2.5 rounded-2xl border-[1.5px] border-line-inverse bg-surface-inverse py-3 pr-3 pl-4 text-on-inverse"
      >
        <p className="text-sm leading-snug">{message}</p>
        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
