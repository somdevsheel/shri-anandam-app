import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Query key factory — centralized so invalidation calls can't typo a key and silently no-op. */
export const queryKeys = {
  orders: (params: Record<string, unknown>) => ["orders", params] as const,
  order: (id: string) => ["order", id] as const,
  products: (params: Record<string, unknown>) => ["products", params] as const,
  product: (id: string) => ["product", id] as const,
  categories: (params: Record<string, unknown>) => ["categories", params] as const,
  addons: (params: Record<string, unknown>) => ["addons", params] as const,
  branches: (params: Record<string, unknown>) => ["branches", params] as const,
  coupons: (params: Record<string, unknown>) => ["coupons", params] as const,
  inventory: (params: Record<string, unknown>) => ["inventory", params] as const,
  inventoryTransactions: (id: string, params: Record<string, unknown>) => ["inventory-transactions", id, params] as const,
  customers: (params: Record<string, unknown>) => ["customers", params] as const,
  customer: (id: string) => ["customer", id] as const,
  staff: (params: Record<string, unknown>) => ["staff", params] as const,
  staffMember: (id: string) => ["staff-member", id] as const,
  roles: ["roles"] as const,
  permissions: ["permissions"] as const,
  reconciliation: (params: Record<string, unknown>) => ["reconciliation", params] as const,
};
