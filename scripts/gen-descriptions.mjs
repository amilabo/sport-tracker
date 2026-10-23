// Builds src/content/exercise-descriptions.ts from ../docs/exercise-descriptions.md (the project folder, outside
// this repo). Run after editing the document: npm run gen:descriptions. Fails if an exercise has no description.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const APP = fileURLToPath(new URL("..", import.meta.url));
const ROOT = `${APP}/..`;
const md = readFileSync(`${ROOT}/docs/exercise-descriptions.md`, "utf8").replace(/\r/g, "");
const cat = readFileSync(`${APP}/src/db/seed/catalog.ts`, "utf8");
const seed = [...cat.matchAll(/ex\("([a-z0-9_]+)", "([^"]+)"/g)].map((m) => ({ key: m[1], name: m[2] }));
const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const byName = new Map(seed.map((s) => [norm(s.name), s.key]));
const clean = (s) => s.replace(/\*\*/g, "").trim();

const out = {};
const blocks = md.split(/\n#### /).slice(1);
for (const b of blocks) {
  const lines = b.split("\n");
  const name = lines[0].replace(/\s+—\s+новое\s*$/, "").trim();
  const key = byName.get(norm(name));
  if (!key) throw new Error("no catalog match: " + name);
  if (out[key]) throw new Error("twice: " + name);
  const steps = lines.filter((l) => /^\d+\.\s/.test(l)).map((l) => clean(l.replace(/^\d+\.\s+/, "")));
  const imp = lines.find((l) => l.startsWith("**Важно:**"));
  if (steps.length < 3 || !imp) throw new Error("incomplete: " + name);
  out[key] = { steps, important: clean(imp.replace("**Важно:**", "")) };
}
const missing = seed.filter((s) => !out[s.key]).map((s) => s.name);
if (missing.length) throw new Error("missing: " + missing.join(", "));
const general = "Перед рабочими подходами — 1–2 лёгких разминочных. Выдох — на усилии.";

const q = (s) => JSON.stringify(s);
let ts = `// Generated from docs/exercise-descriptions.md (the draft, to be checked with a coach). Do not edit by hand:
// change the document and run npm run gen:descriptions. Keys are SEED_EXERCISES keys.

export interface CatalogDescription {
  steps: string[];
  /** The one thing to watch, shown as «Важно» and as the one-line hint on the workout card. */
  important: string;
}

/** Shown under every catalog description. */
export const GENERAL_TIP = ${q(general)};

export const CATALOG_DESCRIPTIONS: Record<string, CatalogDescription> = {
`;
for (const s of seed) {
  const d = out[s.key];
  ts += `  ${s.key}: {\n    steps: [\n${d.steps.map((x) => `      ${q(x)},`).join("\n")}\n    ],\n    important: ${q(d.important)},\n  },\n`;
}
ts += "};\n";
mkdirSync(`${APP}/src/content`, { recursive: true });
writeFileSync(`${APP}/src/content/exercise-descriptions.ts`, ts);
console.log("seed", seed.length, "described", Object.keys(out).length, "bytes", Buffer.byteLength(ts));
