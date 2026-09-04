import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrderStatusDto, AddOrderNoteDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Order, OrderNote, PaginatedResult } from "@/lib/types";

interface ListOrdersParams {
  status?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useOrders(params: ListOrdersParams) {
  return useQuery({
    queryKey: queryKeys.orders(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Order>>("/orders", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
    refetchInterval: 20_000,
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
      queryClient.setQueryData<Order | undefined>(queryKeys.order(orderId), (order) =>
        order ? { ...order, notes: [...order.notes, note] } : order,
      );
    },
  });
}
