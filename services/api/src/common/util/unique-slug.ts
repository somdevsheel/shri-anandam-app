import { slugify } from "./slugify";

/**
 * Generates a slug from `name` (or uses the caller-supplied one) and
 * appends "-2", "-3", ... until `exists` reports no collision. Used by
 * Category and Product creation so an admin never has to hand-craft a
 * unique slug — but an explicitly supplied slug is still honored/checked
 * as given.
 */
export async function ensureUniqueSlug(
  desired: string | undefined,
  name: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(desired && desired.length > 0 ? desired : name);
  let candidate = base || "item";
  let attempt = 1;
  while (await exists(candidate)) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}
