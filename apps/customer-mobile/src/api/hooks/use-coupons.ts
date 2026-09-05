import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../client";
import type { CouponPreview } from "../types";

/**
 * Preview-only — no side effects on the server. The actual application
 * happens server-side inside OrdersService.createOrder() when the same
 * code is sent as `couponCode`, which re-validates independently (a code
 * can expire/hit its limit in the gap between preview and placing the
 * order).
 */
export function useApplyCoupon() {
  return useMutation({
    mutationFn: (code: string) => apiRequest<CouponPreview>("/coupons/preview", { method: "POST", body: { code } }),
  });
}
