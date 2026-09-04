import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000, // shorter than admin-web's — this screen IS the "realtime order queue" until Phase 11's WebSocket layer replaces the poll
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export const queryKeys = {
  queue: (params: Record<string, unknown>) => ["queue", params] as const,
  order: (id: string) => ["order", id] as const,
};
