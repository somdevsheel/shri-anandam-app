/**
 * Flattens a category tree (top-level first, each followed immediately
 * by its own children indented with "— ") for use in a plain <select> —
 * without this a subcategory like "Veg Momos" is indistinguishable from
 * a top-level one like "Momos" in an alphabetical/unordered flat list.
 */
export function orderedCategoriesWithDepth(categories: { id: string; name: string; parentId: string | null }[]) {
  const byParent = new Map<string | null, typeof categories>();
  for (const c of categories) {
    const key = c.parentId;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const result: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      result.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}` });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}
