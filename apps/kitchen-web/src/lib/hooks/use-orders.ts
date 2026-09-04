import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { OrderStatus } from "@shri-anandam/shared-types";
import type { UpdateOrderStatusDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Order, PaginatedResult } from "@/lib/types";

const ACTIVE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
] as const;

/**
 * services/api's `/orders` admin list only filters by a single status at
 * a time (`listOrdersAdminQuerySchema` — no "IN" support), and it's
 * sorted, not scoped to "today" — an unfiltered, oldest-first fetch
 * would return the oldest orders EVER placed once daily volume exceeds
 * one page, not today's active ones (caught before shipping, not after:
 * every status bucket here is small by nature — a kitchen realistically
 * never has 50+ simultaneous PENDING orders — so one bounded query per
 * active status and a client-side merge is both correct and cheap,
 * unlike trying to page through the unfiltered/unscoped list).
 */
export function useQueue() {
  const results = useQueries({
    queries: ACTIVE_STATUSES.map((status) => ({
      queryKey: queryKeys.queue({ status }),
      queryFn: () => apiRequest<PaginatedResult<Order>>("/orders", { query: { status, pageSize: 50, sortOrder: "asc" } }),
      refetchInterval: 5_000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error;
  const orders = results.every((r) => r.data)
    ? results
        .flatMap((r) => r.data!.items)
        .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime())
    : undefined;

  return { data: orders, isLoading, error };
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ""),
    queryFn: () => apiRequest<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: 5_000,
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOrderStatusDto) => apiRequest<Order>(`/orders/${orderId}/status`, { method: "PATCH", body: dto }),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(orderId), order);
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}
