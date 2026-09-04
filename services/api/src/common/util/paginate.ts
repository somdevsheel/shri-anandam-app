import type { PaginatedResult, PaginationParams } from "@shri-anandam/shared-types";

/**
 * Runs a `findMany`-shaped query and a `count`-shaped query in parallel
 * and assembles the standard PaginatedResult envelope (section 42). Every
 * list endpoint in the API returns this shape.
 */
export async function paginate<T>(
  params: Required<PaginationParams>,
  run: (args: { skip: number; take: number }) => Promise<[T[], number]>,
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const [items, totalItems] = await run({ skip: (page - 1) * pageSize, take: pageSize });

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}
