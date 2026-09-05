import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { DeliveryZone, PaginatedResult } from "@/lib/types";

export function useDeliveryZones(params: { branchId?: string; isActive?: boolean; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.deliveryZones(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<DeliveryZone>>("/delivery-zones", { query: { ...params, pageSize: params.pageSize ?? 100 } }),
  });
}

export function useCreateDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDeliveryZoneDto) => apiRequest<DeliveryZone>("/delivery-zones", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}

export function useUpdateDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDeliveryZoneDto }) => apiRequest<DeliveryZone>(`/delivery-zones/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}

export function useDeactivateDeliveryZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<DeliveryZone>(`/delivery-zones/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delivery-zones"] }),
  });
}
