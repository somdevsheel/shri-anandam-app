import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrderStatusDto, AddOrderNoteDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { Order, OrderNote, PaginatedResult } from "../types";

interface ListOrdersParams {
  status?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export function useOrders(params: ListOrdersParams) {
  return useQuery({
    queryKey: queryKeys.orders(params as Record<string, unknown>),
    queryFn: () =>
      apiRequest<PaginatedResult<Order>>("/orders", {
        query: { status: params.status, branchId: params.branchId, page: params.page ?? 1, pageSize: params.pageSize ?? 20 },
      }),
    // Pending/active orders are the whole point of this screen (section
    // 19: "the owner needs to know within seconds") — poll while no
    // realtime layer exists yet (Phase 11 adds WebSockets and this
    // interval goes away or grows much longer).
    refetchInterval: 15_000,
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ""),
    queryFn: () => apiRequest<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateOrderStatusDto) => apiRequest<Order>(`/orders/${orderId}/status`, { method: "PATCH", body: dto }),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.order(orderId), order);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useAddOrderNote(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddOrderNoteDto) => apiRequest<OrderNote>(`/orders/${orderId}/notes`, { method: "POST", body: dto }),
    onSuccess: (note) => {
      // The endpoint returns just the created note, not the whole order
      // (services/api/src/orders/orders.service.ts addNote()) — append
      // it to the cached order rather than refetching.
      queryClient.setQueryData<Order | undefined>(queryKeys.order(orderId), (order) =>
        order ? { ...order, notes: [...order.notes, note] } : order,
      );
    },
  });
}
