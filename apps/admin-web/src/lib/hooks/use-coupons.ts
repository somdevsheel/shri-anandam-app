import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCouponDto, UpdateCouponDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Coupon, PaginatedResult } from "@/lib/types";

export function useCoupons(params: { isActive?: boolean; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.coupons(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Coupon>>("/coupons", { query: { ...params, pageSize: params.pageSize ?? 100 } }),
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCouponDto) => apiRequest<Coupon>("/coupons", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCouponDto }) => apiRequest<Coupon>(`/coupons/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}

export function useDeactivateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Coupon>(`/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });
}
