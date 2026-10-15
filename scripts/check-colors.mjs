// Forbids hard-coded colors outside theme files: hex, rgb()/hsl()/oklch(),
// and Tailwind palette classes like bg-orange-500. Colors come only from tokens.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scanDirs = ["src/app", "src/components", "src/lib", "src/db", "src/domain"].map((d) => join(root, d));
const exts = /\.(tsx?|jsx?|css)$/;
// Files that may contain literal colors.
const allowed = new Set([]);

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const rules = [
  { re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/g, what: "hex color" },
  { re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g, what: "color function" },
  { re: new RegExp(`\\b(?:bg|text|border|fill|stroke|ring|outline|from|to|via|shadow|accent|caret|decoration|divide|placeholder)-(?:${PALETTE})(?:-\\d{2,3})?\\b`, "g"), what: "Tailwind palette class" },
];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of scanDirs.flatMap((d) => walk(d))) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (allowed.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    // Skip comments and HTML entities such as &#160;
    const code = line.replace(/\/\/.*$/, "").replace(/&#\w+;/g, "");
    for (const { re, what } of rules) {
      for (const m of code.matchAll(re)) problems.push(`${rel}:${i + 1}  ${what}: ${m[0]}`);
    }
  });
}

if (problems.length) {
  console.error("Hard-coded colors found (use semantic tokens instead):\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("Color check passed: no hard-coded colors outside themes.");
