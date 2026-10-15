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
