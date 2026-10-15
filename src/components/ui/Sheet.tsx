"use client";

import { useEffect, useRef } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Pinned under the scrollable content (main actions within thumb reach). */
  footer?: React.ReactNode;
}

/** Bottom sheet on a native <dialog>: focus trap, Esc and the back gesture come for free. */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A tap on the backdrop (the dialog box itself, outside the panel) closes the sheet.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className="sheet fixed inset-x-0 top-auto bottom-0 m-0 mx-auto hidden max-h-[88dvh] open:flex w-full max-w-[480px] flex-col rounded-t-[24px] bg-bg p-0 text-ink"
    >
      {open && (
        <>
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <h2 className="flex-1 font-display text-[15px] font-bold tracking-[0.02em] uppercase">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex h-11 w-11 items-center justify-center rounded-xl border-[1.5px] border-line"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          {footer && <div className="pb-safe border-t border-line px-4 pt-3">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
