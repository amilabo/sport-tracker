import type { RestSettings } from "@/domain/rest";
import type { PlanCircuit } from "@/domain/types";
import type { EditorRow } from "./PlanItemCard";

// Unsaved edits of the plan editor (stage 50а): kept while you step away — the exercise screen from the plan (stage 50,
// mockup И1), a reload, the phone dropping the app from memory — and offered back when the same plan is opened again.
// Only on this device (localStorage), only while the plan itself has not changed since (`base`), at most 12 hours.

const PREFIX = "plan-editor-draft:";
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export interface EditorDraft {
  name: string;
  rows: EditorRow[];
  rest: RestSettings;
  circuits: PlanCircuit[];
}

interface Stored extends EditorDraft {
  v: 1;
  /** The saved plan the edits were made on (the editor's snapshot): changed since — the draft is stale. */
  base: string;
  at: number;
}

const keyOf = (id: string | null) => PREFIX + (id ?? "new");

export function readDraft(id: string | null, base: string, now = Date.now()): EditorDraft | null {
  try {
    const raw = localStorage.getItem(keyOf(id));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Stored>;
    const valid = d.v === 1 && d.base === base && typeof d.at === "number" && now - d.at <= DRAFT_TTL_MS && Array.isArray(d.rows) && typeof d.name === "string" && !!d.rest;
    if (!valid) {
      localStorage.removeItem(keyOf(id));
      return null;
    }
    return { name: d.name!, rows: d.rows!, rest: d.rest!, circuits: Array.isArray(d.circuits) ? d.circuits : [] };
  } catch {
    return null;
  }
}

export function writeDraft(id: string | null, base: string, draft: EditorDraft, now = Date.now()): void {
  try {
    const stored: Stored = { v: 1, base, at: now, ...draft };
    localStorage.setItem(keyOf(id), JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the editor works as before, without a draft.
  }
}

// «История и график» from the editor (stage 50, mockup И1): coming back is expected, so the edits come back silently.
const QUIET_KEY = "plan-editor-quiet";

/** Marks the next return to this plan's editor as a planned one: no «Вернули несохранённые правки». */
export function markQuietReturn(id: string | null): void {
  try {
    sessionStorage.setItem(QUIET_KEY, keyOf(id));
  } catch {
    // Without storage the message just shows.
  }
}

/** True once after `markQuietReturn` for the same plan. */
export function takeQuietReturn(id: string | null): boolean {
  try {
    const quiet = sessionStorage.getItem(QUIET_KEY) === keyOf(id);
    sessionStorage.removeItem(QUIET_KEY);
    return quiet;
  } catch {
    return false;
  }
}

export function clearDraft(id: string | null): void {
  try {
    localStorage.removeItem(keyOf(id));
  } catch {
    // Nothing to clear.
  }
}
