/** Trims and collapses inner whitespace of a user-entered name. */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Key for case- and ё-insensitive comparison and search. */
export function searchKey(value: string): string {
  return cleanName(value).toLocaleLowerCase("ru").replaceAll("ё", "е");
}

export function compareRu(a: string, b: string): number {
  return a.localeCompare(b, "ru", { sensitivity: "base" });
}

export const DESCRIPTION_MAX = 2000;

/** Own text as typed: trimmed lines, at most one empty line in a row; empty → null. */
export function cleanDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, DESCRIPTION_MAX) : null;
}
