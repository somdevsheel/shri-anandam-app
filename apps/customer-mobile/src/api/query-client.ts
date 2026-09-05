import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => {
        // Retrying a 4xx (bad request, not found, forbidden) just repeats
        // the same failure — only transient/network-shaped errors are
        // worth a retry.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Query key factory — centralized so invalidation calls can't typo a key and silently no-op. */
export const queryKeys = {
  categories: ["categories"] as const,
  products: (params: Record<string, unknown>) => ["products", params] as const,
  product: (slug: string) => ["product", slug] as const,
  cart: ["cart"] as const,
  profile: ["profile"] as const,
  addresses: ["addresses"] as const,
  orders: (params: Record<string, unknown>) => ["orders", params] as const,
  order: (id: string) => ["order", id] as const,
  notifications: (params: Record<string, unknown>) => ["notifications", params] as const,
  branches: ["branches"] as const,
};
