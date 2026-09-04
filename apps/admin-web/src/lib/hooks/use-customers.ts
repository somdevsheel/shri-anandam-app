import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateCustomerAdminDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Customer, CustomerDetail, PaginatedResult } from "@/lib/types";

interface ListCustomersParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export function useCustomers(params: ListCustomersParams) {
  return useQuery({
    queryKey: queryKeys.customers(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Customer>>("/admin/customers", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ""),
    queryFn: () => apiRequest<CustomerDetail>(`/admin/customers/${id}`),
    enabled: !!id,
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomerAdminDto) => apiRequest<CustomerDetail>(`/admin/customers/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.customer(id), customer);
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
