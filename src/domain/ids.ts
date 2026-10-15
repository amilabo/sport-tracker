/** Random UUID v4. Falls back to getRandomValues: randomUUID needs a secure context (not plain http on a LAN). */
export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

/**
 * Deterministic UUID for seed records (built-in exercises, starter plans, built-in measurement types).
 * The same key gives the same id on every device, so merging backups does not duplicate the catalog.
 */
export function seedId(key: string): string {
  const bytes = new Uint8Array(16);
  // Four independent 32-bit FNV-1a hashes with different seeds → 128 bits.
  for (let part = 0; part < 4; part++) {
    let h = 0x811c9dc5 ^ (part * 0x9e3779b1);
    const input = `${part}:${key}`;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    for (let j = 0; j < 4; j++) bytes[part * 4 + j] = (h >>> (j * 8)) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

function formatUuid(b: Uint8Array) {
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
