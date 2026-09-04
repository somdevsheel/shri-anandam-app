import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddCartItemDto, UpdateCartItemDto } from "@shri-anandam/validation";
import { apiRequest } from "../client";
import { queryKeys } from "../query-client";
import type { CartResponse } from "../types";

export function useCart() {
  return useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => apiRequest<CartResponse>("/cart"),
    staleTime: 0, // price/availability must always reflect the latest server state — see cart.service.ts's pricing comment
  });
}

/** Every cart mutation below refetches the cart afterward rather than optimistically patching the cache — the server-computed price/issues are the point of a server-aware cart (section 6), so a locally-guessed cache update would defeat it. */
function useCartMutation<TVariables>(mutationFn: (vars: TVariables) => Promise<CartResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.cart, data);
    },
  });
}

export function useAddCartItem() {
  return useCartMutation((dto: AddCartItemDto) => apiRequest<CartResponse>("/cart/items", { method: "POST", body: dto }));
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, dto }: { itemId: string; dto: UpdateCartItemDto }) =>
    apiRequest<CartResponse>(`/cart/items/${itemId}`, { method: "PATCH", body: dto }),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => apiRequest<CartResponse>(`/cart/items/${itemId}`, { method: "DELETE" }));
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ message: string }>("/cart", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<CartResponse>(queryKeys.cart, { cart: null, subtotalInPaise: 0, itemCount: 0, issues: [] });
    },
  });
}
