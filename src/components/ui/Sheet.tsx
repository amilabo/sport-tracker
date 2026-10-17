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
  // The native "close" event also fires when we close the dialog because `open` became false;
  // that is not the user dismissing it, so onClose must not run (it could undo the parent's next step).
  const closingFromProp = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) {
      closingFromProp.current = true;
      dialog.close();
    }
  }, [open]);

  // The on-screen keyboard: keep the sheet (search results, suggestions) above it. Android resizes the
  // page itself (viewport interactive-widget); iOS lays the keyboard over it — lift the sheet by its height.
  useEffect(() => {
    const dialog = ref.current;
    const vv = window.visualViewport;
    if (!open || !dialog || !vv) return;
    const update = () => {
      dialog.style.setProperty("--kb", `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
      dialog.style.setProperty("--vvh", `${Math.round(vv.height - 12)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (closingFromProp.current) closingFromProp.current = false;
        else onClose();
      }}
      onClick={(e) => {
        // A tap on the backdrop (the dialog box itself, outside the panel) closes the sheet.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className="sheet fixed inset-x-0 top-auto bottom-[var(--kb,0px)] m-0 mx-auto hidden max-h-[min(88dvh,var(--vvh,88dvh))] open:flex w-full max-w-[480px] flex-col rounded-t-[24px] bg-bg p-0 text-ink"
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
