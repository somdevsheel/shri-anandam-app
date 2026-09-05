import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { Category, PaginatedResult, Product, PublicBranch } from "../types";

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiRequest<Category[]>("/catalog/categories", { skipAuth: true }),
    staleTime: 5 * 60_000, // categories change rarely — cache longer than the default
  });
}

export function useBranches() {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiRequest<PublicBranch[]>("/catalog/branches", { skipAuth: true }),
    staleTime: 5 * 60_000, // branch contact info changes rarely
  });
}

export interface ProductListParams {
  categoryId?: string;
  branchId?: string;
  search?: string;
  isFeatured?: boolean;
  tag?: string;
  // An explicit index signature (not just optional named properties) is
  // what lets this interface satisfy `Record<string, ...>` in
  // apiRequest's `query` param — TS doesn't structurally allow a plain
  // named interface there without one, even when every property matches.
  [key: string]: string | number | boolean | undefined;
}

const PAGE_SIZE = 20;

/** Infinite-scroll product listing — backs both the Home "featured" rail and the category/search results screen. */
export function useProducts(params: ProductListParams) {
  return useInfiniteQuery({
    queryKey: queryKeys.products(params),
    queryFn: ({ pageParam }) =>
      apiRequest<PaginatedResult<Product>>("/catalog/products", {
        skipAuth: true,
        query: { ...params, page: pageParam, pageSize: PAGE_SIZE },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(slug ?? ""),
    queryFn: () => apiRequest<Product>(`/catalog/products/${slug}`, { skipAuth: true }),
    enabled: Boolean(slug),
  });
}
