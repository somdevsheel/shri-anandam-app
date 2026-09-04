const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

/** Converts a display name into a URL-safe slug: lowercase, hyphenated, ASCII-only. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_DIACRITICAL_MARKS, "") // e.g. "é" -> "e" after NFKD splits it into "e" + a combining accent
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}
