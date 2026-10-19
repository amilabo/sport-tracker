// Checks every theme × mode block in src/styles/themes/*.css, and every theme × mode × accent
// (src/styles/accents.css): all required tokens are present and key token pairs meet WCAG AA.
// Exits with code 1 on any failure, so a theme that fails does not build.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const themesDir = join(root, "src", "styles", "themes");
const accentsFile = join(root, "src", "styles", "accents.css");

export const REQUIRED_TOKENS = [
  "bg", "surface", "surface-raised", "surface-done", "surface-inverse",
  "ink", "ink-muted", "ink-faint", "on-inverse", "on-inverse-muted",
  "line", "line-strong", "line-inverse",
  "accent", "on-accent", "accent-text", "accent-line", "accent-on-inverse",
  "danger", "danger-on-inverse", "positive-on-inverse", "focus",
  "chart-line", "chart-grid", "chart-label",
];

// An accent block defines exactly these and nothing else: it must not repaint the theme.
export const ACCENT_TOKENS = ["accent", "on-accent", "accent-text", "accent-line", "accent-on-inverse", "chart-line"];

// [foreground, background, minimum ratio]
// 4.5 — body text, 3 — large text (≥ 24 px or ≥ 19 px bold) and UI graphics.
export const PAIRS = [
  ["ink", "bg", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "surface-raised", 4.5],
  ["ink", "surface-done", 4.5],
  ["ink-muted", "bg", 4.5],
  ["ink-muted", "surface", 4.5],
  ["ink-muted", "surface-done", 4.5],
  ["ink-faint", "bg", 4.5],
  ["ink-faint", "surface", 4.5],
  ["accent-text", "bg", 4.5],
  ["accent-text", "surface", 4.5],
  ["accent-line", "bg", 3],
  ["accent-line", "surface", 3],
  ["accent-line", "surface-raised", 3],
  ["accent-on-inverse", "surface-inverse", 4.5],
  ["danger", "bg", 4.5],
  ["danger", "surface", 4.5],
  ["danger-on-inverse", "surface-inverse", 4.5],
  ["on-inverse", "surface-inverse", 4.5],
  ["on-inverse-muted", "surface-inverse", 4.5],
  ["positive-on-inverse", "surface-inverse", 4.5],
  ["on-accent", "accent", 4.5],
  ["chart-label", "surface-inverse", 4.5],
  ["accent", "surface-inverse", 3],
  ["chart-line", "surface-inverse", 3],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
];

function channel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Token blocks whose selector has [data-<attr>="…"][data-mode="…"]. */
function parseBlocks(css, attr) {
  const blocks = [];
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  const idRe = new RegExp(`\\[data-${attr}="([^"]+)"\\]`);
  let m;
  while ((m = blockRe.exec(css))) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const id = selector.match(idRe)?.[1];
    const mode = selector.match(/\[data-mode="([^"]+)"\]/)?.[1];
    if (!id || !mode) continue;
    const tokens = {};
    for (const t of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      tokens[t[1]] = t[2].trim();
    }
    blocks.push({ [attr]: id, mode, tokens });
  }
  return blocks;
}

export function parseThemes(css) {
  return parseBlocks(css, "theme");
}

export function parseAccents(css) {
  return parseBlocks(css, "accent");
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Problems of one full token set: a theme block, or a theme block with an accent on top. */
export function checkTokens(label, tokens) {
  const errors = [];
  let checked = 0;
  for (const name of REQUIRED_TOKENS) {
    const value = tokens[name];
    if (!value) errors.push(`${label}: missing --${name}`);
    else if (!HEX.test(value)) errors.push(`${label}: --${name} must be a hex color, got "${value}"`);
  }
  for (const [fg, bg, min] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) continue;
    const ratio = contrast(tokens[fg], tokens[bg]);
    checked++;
    if (ratio < min) errors.push(`${label}: --${fg} on --${bg} = ${ratio.toFixed(2)}:1 (need ${min}:1)`);
  }
  return { errors, checked };
}

/** Every accent has a light and a dark block with exactly ACCENT_TOKENS. */
export function checkAccents(accents) {
  const errors = [];
  for (const { accent, mode, tokens } of accents) {
    for (const name of ACCENT_TOKENS) if (!tokens[name]) errors.push(`accent ${accent} × ${mode}: missing --${name}`);
    for (const name of Object.keys(tokens)) {
      if (!ACCENT_TOKENS.includes(name)) errors.push(`accent ${accent} × ${mode}: --${name} is not an accent token`);
    }
  }
  for (const id of new Set(accents.map((a) => a.accent))) {
    for (const mode of ["light", "dark"]) {
      if (!accents.some((a) => a.accent === id && a.mode === mode)) errors.push(`accent ${id}: no ${mode} block`);
    }
  }
  return errors;
}

function main() {
  const files = readdirSync(themesDir).filter((f) => f.endsWith(".css"));
  const accents = parseAccents(readFileSync(accentsFile, "utf8"));
  const errors = checkAccents(accents);
  let checked = 0;

  for (const file of files) {
    const blocks = parseThemes(readFileSync(join(themesDir, file), "utf8"));
    if (blocks.length === 0) errors.push(`${file}: no [data-theme][data-mode] blocks`);

    for (const { theme, mode, tokens } of blocks) {
      const sets = [[`${theme} × ${mode}`, tokens]];
      for (const a of accents.filter((x) => x.mode === mode)) {
        sets.push([`${theme} × ${mode} × ${a.accent}`, { ...tokens, ...a.tokens }]);
      }
      for (const [label, set] of sets) {
        const r = checkTokens(label, set);
        errors.push(...r.errors);
        checked += r.checked;
      }
    }
  }

  if (errors.length) {
    console.error("Contrast check failed:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  const accentCount = new Set(accents.map((a) => a.accent)).size;
  console.log(`Contrast check passed: ${checked} pairs in ${files.length} theme file(s) × ${accentCount} accents.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
