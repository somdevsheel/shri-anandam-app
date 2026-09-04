import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignProductAddonsDto,
  AssignProductBranchesDto,
  CreateProductDto,
  CreateProductImageDto,
  CreateProductVariantDto,
  UpdateProductDto,
  UpdateProductVariantDto,
} from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { PaginatedResult, Product, ProductImage, ProductVariant } from "@/lib/types";

interface ListProductsParams {
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useProducts(params: ListProductsParams) {
  return useQuery({
    queryKey: queryKeys.products(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Product>>("/products", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ""),
    queryFn: () => apiRequest<Product>(`/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductDto) => apiRequest<Product>("/products", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProductDto) => apiRequest<Product>(`/products/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (product) => {
      queryClient.setQueryData(queryKeys.product(id), product);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Product>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

function invalidateProduct(queryClient: ReturnType<typeof useQueryClient>, productId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.product(productId) });
}

export function useAddVariant(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductVariantDto) => apiRequest<ProductVariant>(`/products/${productId}/variants`, { method: "POST", body: dto }),
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useUpdateVariant(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, dto }: { variantId: string; dto: UpdateProductVariantDto }) =>
      apiRequest<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "PATCH", body: dto }),
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useRemoveVariant(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => apiRequest<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useAddImage(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductImageDto) => apiRequest<ProductImage>(`/products/${productId}/images`, { method: "POST", body: dto }),
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useRemoveImage(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => apiRequest<{ message: string }>(`/products/${productId}/images/${imageId}`, { method: "DELETE" }),
    onSuccess: () => invalidateProduct(queryClient, productId),
  });
}

export function useAssignAddons(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignProductAddonsDto) => apiRequest<Product>(`/products/${productId}/addons`, { method: "PATCH", body: dto }),
    onSuccess: (product) => queryClient.setQueryData(queryKeys.product(productId), product),
  });
}

export function useAssignProductBranches(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignProductBranchesDto) => apiRequest<Product>(`/products/${productId}/branches`, { method: "PATCH", body: dto }),
    onSuccess: (product) => queryClient.setQueryData(queryKeys.product(productId), product),
  });
}
