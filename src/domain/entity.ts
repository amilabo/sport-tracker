import { uuid } from "./ids";
import { nowIso } from "./time";
import type { BaseEntity } from "./types";

/** Adds id, timestamps and is_demo to new record fields. */
export function newEntity<T extends object>(fields: T, opts: { id?: string; is_demo?: boolean; at?: string } = {}): T & BaseEntity {
  const at = opts.at ?? nowIso();
  return {
    ...fields,
    id: opts.id ?? uuid(),
    created_at: at,
    updated_at: at,
    is_demo: opts.is_demo ?? false,
  };
}

/** Applies a patch and bumps updated_at (used by backup merge to pick the newer version). */
export function touch<T extends BaseEntity>(record: T, patch: Partial<Omit<T, keyof BaseEntity>> = {}): T {
  return { ...record, ...patch, updated_at: nowIso() };
}
