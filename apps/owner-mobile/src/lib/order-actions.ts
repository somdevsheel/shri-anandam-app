import { ORDER_STATUS_TRANSITIONS, OrderStatus, Permission } from "@shri-anandam/shared-types";

/**
 * Client-side mirror of STATUS_PERMISSION in
 * services/api/src/orders/orders.service.ts — which permission a
 * transition TO a given status requires. Kept here, not imported,
 * because the backend map isn't exported from a shared package; this is
 * purely a UI-gating convenience (show the button only if the tap would
 * likely succeed) — the server re-checks this on every request
 * regardless (section 66: never trust the client for authorization), so
 * drift between the two only ever produces a worse error message, never
 * a security gap.
 */
const STATUS_PERMISSION: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.ACCEPTED]: Permission.ORDER_ACCEPT,
  [OrderStatus.PREPARING]: Permission.ORDER_ACCEPT,
  [OrderStatus.READY]: Permission.ORDER_ACCEPT,
  [OrderStatus.OUT_FOR_DELIVERY]: Permission.ORDER_ACCEPT,
  [OrderStatus.DELIVERED]: Permission.ORDER_ACCEPT,
  [OrderStatus.REJECTED]: Permission.ORDER_REJECT,
  [OrderStatus.CANCELLED]: Permission.ORDER_CANCEL,
};

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.ACCEPTED]: "Accept Order",
  [OrderStatus.PREPARING]: "Start Preparing",
  [OrderStatus.READY]: "Mark Ready",
  [OrderStatus.OUT_FOR_DELIVERY]: "Out for Delivery",
  [OrderStatus.DELIVERED]: "Mark Delivered",
  [OrderStatus.REJECTED]: "Reject Order",
  [OrderStatus.CANCELLED]: "Cancel Order",
};

/** "Destructive" actions get the danger button variant instead of primary. */
const DESTRUCTIVE_STATUSES = new Set<OrderStatus>([OrderStatus.REJECTED, OrderStatus.CANCELLED]);

export interface OrderAction {
  status: OrderStatus;
  label: string;
  variant: "primary" | "danger";
}

/**
 * For pickup orders, READY -> DELIVERED skips OUT_FOR_DELIVERY entirely
 * (ORDER_STATUS_TRANSITIONS already encodes this — see
 * packages/shared-types/src/enums/order-status.ts), so a pickup order's
 * "Mark Ready" screen offers a "Mark Delivered" action, never "Out for
 * Delivery", without this file needing its own fulfillment-type branch.
 */
export function getAvailableActions(
  currentStatus: OrderStatus,
  fulfillmentType: "DELIVERY" | "PICKUP",
  staffPermissions: string[],
): OrderAction[] {
  const candidates = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];

  return candidates
    .filter((status) => {
      if (fulfillmentType === "PICKUP" && status === OrderStatus.OUT_FOR_DELIVERY) return false;
      const requiredPermission = STATUS_PERMISSION[status];
      return !!requiredPermission && staffPermissions.includes(requiredPermission);
    })
    .map((status) => ({
      status,
      label: ACTION_LABELS[status] ?? status,
      variant: DESTRUCTIVE_STATUSES.has(status) ? "danger" : "primary",
    }));
}
