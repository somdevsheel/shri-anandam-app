import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateCustomerProfileDto,
} from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { CustomerAddress, CustomerProfile } from "../types";

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => apiRequest<CustomerProfile>("/customers/me"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomerProfileDto) => apiRequest<CustomerProfile>("/customers/me", { method: "PATCH", body: dto }),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.profile, data),
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: queryKeys.addresses,
    queryFn: () => apiRequest<CustomerAddress[]>("/customers/me/addresses"),
  });
}

function useInvalidateAddresses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
}

export function useCreateAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: (dto: CreateCustomerAddressDto) =>
      apiRequest<CustomerAddress>("/customers/me/addresses", { method: "POST", body: dto }),
    onSuccess: invalidate,
  });
}

export function useUpdateAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerAddressDto }) =>
      apiRequest<CustomerAddress>(`/customers/me/addresses/${id}`, { method: "PATCH", body: dto }),
    onSuccess: invalidate,
  });
}

export function useSetDefaultAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: (id: string) => apiRequest<CustomerAddress>(`/customers/me/addresses/${id}/default`, { method: "PATCH" }),
    onSuccess: invalidate,
  });
}

export function useDeleteAddress() {
  const invalidate = useInvalidateAddresses();
  return useMutation({
    mutationFn: (id: string) => apiRequest<{ message: string }>(`/customers/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
