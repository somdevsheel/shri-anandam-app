import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000, // shorter than customer-mobile's 60s — order status/new orders need to feel near-live even without the realtime layer (Phase 11)
      retry: (failureCount, error) => {
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
  orders: (params: Record<string, unknown>) => ["orders", params] as const,
  order: (id: string) => ["order", id] as const,
  notifications: (params: Record<string, unknown>) => ["notifications", params] as const,
  devices: ["devices"] as const,
};
