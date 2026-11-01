/** Any CSS color form → six-digit hex (what Android's Color.parseColor reads); null if not a color. */
export function toHex(css: string): string | null {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !css.trim()) return null;
  ctx.fillStyle = css.trim();
  return /^#[0-9a-f]{6}$/i.test(ctx.fillStyle) ? ctx.fillStyle : null;
}

/** A theme token as it is now on the page, as six-digit hex («--bg»). */
export function tokenHex(token: string): string | null {
  return toHex(getComputedStyle(document.documentElement).getPropertyValue(token));
}
