import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdjustInventoryDto, CreateInventoryItemDto, RecordWastageDto, RestockInventoryDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { InventoryItem, InventoryTransaction, PaginatedResult } from "@/lib/types";

interface ListInventoryParams {
  branchId?: string;
  productVariantId?: string;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export function useInventory(params: ListInventoryParams) {
  return useQuery({
    queryKey: queryKeys.inventory(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<InventoryItem>>("/inventory", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
  });
}

export function useInventoryTransactions(itemId: string | undefined, params: { page?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.inventoryTransactions(itemId ?? "", params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<InventoryTransaction>>(`/inventory/${itemId}/transactions`, { query: params }),
    enabled: !!itemId,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInventoryItemDto) => apiRequest<InventoryItem>("/inventory", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useRestockInventory(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RestockInventoryDto) => apiRequest<InventoryItem>(`/inventory/${itemId}/restock`, { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useAdjustInventory(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AdjustInventoryDto) => apiRequest<InventoryItem>(`/inventory/${itemId}/adjust`, { method: "PATCH", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useRecordWastage(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordWastageDto) => apiRequest<InventoryItem>(`/inventory/${itemId}/wastage`, { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
}
