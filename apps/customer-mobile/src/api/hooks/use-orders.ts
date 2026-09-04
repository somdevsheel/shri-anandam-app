import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CancelOrderDto, CreateOrderDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { CartResponse, Order, PaginatedResult } from "../types";

interface ListOrdersParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useOrders(params: ListOrdersParams = {}) {
  return useQuery({
    queryKey: queryKeys.orders(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Order>>("/orders", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ""),
    queryFn: () => apiRequest<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  });
}

/**
 * `Idempotency-Key` (section 11) — a UUID generated fresh per checkout
 * attempt on the CALLING screen, not inside this hook, so a retry after
 * a network timeout (same key) reaches the server's replay-safe path
 * instead of silently creating a second order; a new key is only
 * generated for a genuinely new checkout attempt (e.g. cart cleared and
 * re-filled).
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, idempotencyKey }: { dto: CreateOrderDto; idempotencyKey: string }) =>
      apiRequest<Order>("/orders", { method: "POST", body: dto, headers: { "Idempotency-Key": idempotencyKey } }),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}

export function useCancelOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CancelOrderDto) => apiRequest<Order>(`/orders/${orderId}/cancel`, { method: "POST", body: dto }),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(orderId), order);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

/** Response shape is CartResponse + a `skipped` list (services/api/src/orders/orders.service.ts reorder() spreads the resulting cart state directly) — writing it straight into the cart cache, not just invalidating, matches use-cart.ts's own mutation pattern. */
type ReorderResponse = CartResponse & { skipped: { productName: string; reason: string }[] };

export function useReorder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => apiRequest<ReorderResponse>(`/orders/${orderId}/reorder`, { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.cart, data),
  });
}
