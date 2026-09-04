import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateAddonDto, CreateCategoryDto, UpdateAddonDto, UpdateCategoryDto } from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { Addon, Branch, Category, PaginatedResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useCategories(params: { isActive?: boolean; search?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.categories(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Category>>("/categories", { query: { ...params, pageSize: params.pageSize ?? 100 } }),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) => apiRequest<Category>("/categories", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) => apiRequest<Category>(`/categories/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ---------------------------------------------------------------------------
// Addons
// ---------------------------------------------------------------------------

export function useAddons(params: { isActive?: boolean; search?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.addons(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Addon>>("/addons", { query: { ...params, pageSize: params.pageSize ?? 100 } }),
  });
}

export function useCreateAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAddonDto) => apiRequest<Addon>("/addons", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addons"] }),
  });
}

export function useUpdateAddon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateAddonDto }) => apiRequest<Addon>(`/addons/${id}`, { method: "PATCH", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["addons"] }),
  });
}

// ---------------------------------------------------------------------------
// Branches (read-mostly here; full CRUD lives with Organization settings,
// out of Phase 9's scope — branches already exist from Phase 2 seeding)
// ---------------------------------------------------------------------------

export function useBranches(params: { isActive?: boolean; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.branches(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Branch>>("/branches", { query: { ...params, pageSize: params.pageSize ?? 100 } }),
  });
}
