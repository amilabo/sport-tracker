// Builds src/content/exercise-substitutes.ts from ../docs/exercise-substitutes.md (the project folder, outside
// this repo). Run after editing the document: npm run gen:substitutes. Fails on an unknown name, relation,
// movement or muscle, a missing exercise, a self-reference, a repeat, more than 5 substitutes or a long note.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const APP = fileURLToPath(new URL("..", import.meta.url));
const ROOT = `${APP}/..`;
const md = readFileSync(`${ROOT}/docs/exercise-substitutes.md`, "utf8").replace(/\r/g, "");
const cat = readFileSync(`${APP}/src/db/seed/catalog.ts`, "utf8");
const seed = [...cat.matchAll(/ex\("([a-z0-9_]+)", "([^"]+)"/g)].map((m) => ({ key: m[1], name: m[2] }));
const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
const byName = new Map(seed.map((s) => [norm(s.name), s.key]));
const keys = new Set(seed.map((s) => s.key));

const RELATIONS = { "то же движение": "same", "смещает акцент": "angle", "та же мышца": "muscle", "легче": "easier", "сложнее": "harder", "та же нагрузка": "load" };
// «Типы движения»: the table of the document, label → key.
const PATTERNS = Object.fromEntries(
  [...md.matchAll(/^\| ([^|`]+?) \| `([a-z_]+)` \|/gm)].map((m) => [norm(m[1]), m[2]]),
);
PATTERNS["выпад"] = PATTERNS["выпад, одна нога"];
// «Мышцы (словарь для данных)» with its synonyms. Generic words are allowed in secondary muscles only.
const MUSCLES = {
  "грудь": ["chest"], "низ груди": ["chest"], "верх груди": ["chest_upper"],
  "широчайшие": ["lats"], "широчайшие (низ)": ["lats"], "середина спины": ["mid_back"], "верх трапеции": ["traps"], "трапеция": ["traps"],
  "разгибатели спины": ["erectors"],
  "передняя дельта": ["front_delt"], "средняя дельта": ["side_delt"], "задняя дельта": ["rear_delt"], "передняя и средняя дельта": ["front_delt", "side_delt"],
  "вращатели плеча": ["rotator_cuff"],
  "бицепс": ["biceps"], "брахиалис": ["brachialis"], "трицепс": ["triceps"], "длинная головка трицепса": ["triceps_long"], "трицепс (длинная головка)": ["triceps_long"],
  "предплечья": ["forearms"], "хват": ["forearms"],
  "квадрицепс": ["quads"], "задняя поверхность бедра": ["hamstrings"], "приводящие": ["adductors"], "икры": ["calves"],
  "ягодицы": ["glute_max"], "ягодицы (с наклоном)": ["glute_max"], "большая ягодичная": ["glute_max"], "средняя ягодичная": ["glute_med"],
  "прямая мышца": ["abs"], "прямая мышца живота": ["abs"], "низ пресса": ["abs_lower"], "косые": ["obliques"], "поперечная": ["transverse"], "кор": ["core"],
  "кардио": ["cardio"],
  "плечи": ["shoulders"], "ноги": ["legs"], "руки": ["arms"], "спина": ["back"], "всё тело": ["full_body"],
};
const GENERIC = new Set(["shoulders", "legs", "arms", "back", "full_body"]);
const muscles = (text, where, name) =>
  text ? [...new Set(text.split(", ").flatMap((w) => {
    const m = MUSCLES[w.trim()];
    if (!m) throw new Error(`${name}: unknown muscle «${w}»`);
    return m;
  }))] : [];

// Only the group sections: the candidates and the development notes come after.
const body = md.split("\n## Грудь")[1]?.split("\n## Чего не хватает в каталоге")[0];
if (!body) throw new Error("document structure changed: no «## Грудь» … «## Чего не хватает в каталоге»");
const out = {};
for (const block of body.split(/\n#### /).slice(1)) {
  const lines = block.split("\n");
  const name = lines[0].trim();
  const key = byName.get(norm(name));
  if (!key) throw new Error("no catalog match: " + name);
  if (out[key]) throw new Error("twice: " + name);
  const head = lines[1].match(/^`([a-z0-9_]+)` · .+ · (.+)$/);
  if (!head || head[1] !== key) throw new Error(`${name}: second line must be \`${key}\` · … · движение`);
  const pattern = PATTERNS[norm(head[2])];
  if (!pattern) throw new Error(`${name}: unknown movement «${head[2]}»`);
  const mline = lines.find((l) => l.startsWith("Мышцы: "));
  const mm = mline?.match(/^Мышцы: \*\*(.+?)\*\*(?: · (.+))?$/);
  if (!mm) throw new Error(`${name}: no «Мышцы: **…**» line`);
  const primary = muscles(mm[1], "primary", name);
  const secondary = muscles(mm[2], "secondary", name);
  if (primary.some((m) => GENERIC.has(m) && m !== "full_body")) throw new Error(`${name}: generic word in primary muscles`);

  const subs = [];
  let lines5 = 0;
  for (const l of lines) {
    const s = l.match(/^(\d+\.|\+) (.+?) — (.+?) · (.+)$/);
    if (!s) continue;
    lines5++;
    const subKey = byName.get(norm(s[2]));
    if (s[1] === "+") {
      if (subKey) throw new Error(`${name}: «${s[2]}» is in the catalog now — give the «+» line a number`);
      continue;
    }
    if (!subKey) throw new Error(`${name}: no catalog match for substitute «${s[2]}»`);
    if (subKey === key) throw new Error(`${name}: refers to itself`);
    if (subs.some((x) => x.key === subKey)) throw new Error(`${name}: «${s[2]}» twice`);
    const relation = RELATIONS[s[3]];
    if (!relation) throw new Error(`${name}: unknown relation «${s[3]}»`);
    if (s[4].length > 40) throw new Error(`${name}: note longer than 40: «${s[4]}»`);
    subs.push({ key: subKey, relation, note: s[4] });
  }
  if (!subs.length) throw new Error(`${name}: no substitutes`);
  if (lines5 > 5) throw new Error(`${name}: more than 5 substitutes (with «+» lines)`);
  out[key] = { pattern, primary, secondary, subs };
}
const missing = seed.filter((s) => !out[s.key]).map((s) => s.name);
if (missing.length) throw new Error("missing: " + missing.join(", "));
for (const k of Object.keys(out)) if (!keys.has(k)) throw new Error("not in catalog: " + k);

const q = (s) => JSON.stringify(s);
const list = (a) => `[${a.map(q).join(", ")}]`;
const patterns = [...new Set(Object.values(PATTERNS))];
const allMuscles = [...new Set(Object.values(MUSCLES).flat())];
let ts = `// Generated from docs/exercise-substitutes.md (the draft, to be checked with a coach). Do not edit by hand:
// change the document and run npm run gen:substitutes. Keys are SEED_EXERCISES keys.

export const RELATIONS = ${list(Object.values(RELATIONS))} as const;
/** How a substitute relates to the exercise: the first half of its line, «То же движение · гантели». */
export type Relation = (typeof RELATIONS)[number];

export const PATTERNS = ${list(patterns)} as const;
export type Pattern = (typeof PATTERNS)[number];

export const MUSCLES = ${list(allMuscles)} as const;
export type Muscle = (typeof MUSCLES)[number];

export interface CatalogSubstitute {
  key: string;
  relation: Relation;
  /** What differs, ≤ 40 characters: «гантели, по одной руке». */
  note: string;
}

export interface CatalogSubstitutes {
  /** Not shown yet: for a fallback choice and future filters. */
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  /** In order of priority, 1–5. */
  subs: CatalogSubstitute[];
}

export const CATALOG_SUBSTITUTES: Record<string, CatalogSubstitutes> = {
`;
for (const s of seed) {
  const d = out[s.key];
  ts += `  ${s.key}: {\n    pattern: ${q(d.pattern)},\n    primary: ${list(d.primary)},\n    secondary: ${list(d.secondary)},\n    subs: [\n`;
  ts += d.subs.map((x) => `      { key: ${q(x.key)}, relation: ${q(x.relation)}, note: ${q(x.note)} },`).join("\n");
  ts += `\n    ],\n  },\n`;
}
ts += "};\n";
writeFileSync(`${APP}/src/content/exercise-substitutes.ts`, ts);
const total = Object.values(out).reduce((n, d) => n + d.subs.length, 0);
console.log("seed", seed.length, "covered", Object.keys(out).length, "substitutes", total, "bytes", Buffer.byteLength(ts));
