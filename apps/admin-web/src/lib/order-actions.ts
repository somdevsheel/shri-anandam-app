import { ORDER_STATUS_TRANSITIONS, OrderStatus, Permission } from "@shri-anandam/shared-types";

/**
 * Same rationale and mapping as apps/owner-mobile/src/lib/order-actions.ts
 * — a client-side mirror of STATUS_PERMISSION in
 * services/api/src/orders/orders.service.ts, UI-gating only; the server
 * re-checks on every request regardless.
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

const DESTRUCTIVE_STATUSES = new Set<OrderStatus>([OrderStatus.REJECTED, OrderStatus.CANCELLED]);

export interface OrderAction {
  status: OrderStatus;
  label: string;
  variant: "primary" | "danger";
}

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
