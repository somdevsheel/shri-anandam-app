import { ORDER_STATUS_TRANSITIONS, OrderStatus, Permission } from "@shri-anandam/shared-types";

/**
 * Same mirror of STATUS_PERMISSION in services/api/src/orders/orders.service.ts
 * as apps/owner-mobile and apps/admin-web use — UI-gating only. KITCHEN's
 * default role grant (packages/shared-types) has order.accept but not
 * order.reject/order.cancel, so those actions naturally don't appear for
 * a kitchen-role login without this file needing to know about roles at
 * all — it only ever looks at the signed-in staff member's actual
 * permission list.
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
  [OrderStatus.ACCEPTED]: "Accept",
  [OrderStatus.PREPARING]: "Start Preparing",
  [OrderStatus.READY]: "Mark Ready",
  [OrderStatus.OUT_FOR_DELIVERY]: "Out for Delivery",
  [OrderStatus.DELIVERED]: "Mark Delivered",
  [OrderStatus.REJECTED]: "Reject",
  [OrderStatus.CANCELLED]: "Cancel",
};

const DESTRUCTIVE_STATUSES = new Set<OrderStatus>([OrderStatus.REJECTED, OrderStatus.CANCELLED]);

export interface OrderAction {
  status: OrderStatus;
  label: string;
  variant: "primary" | "danger";
}

/** The one "move it forward" action a queue card's big button offers — the first non-destructive action, i.e. never Reject/Cancel (those stay on the order detail screen only, to avoid a one-tap mis-hit cancelling a real order from the card view). */
export function getPrimaryAction(
  currentStatus: OrderStatus,
  fulfillmentType: "DELIVERY" | "PICKUP",
  staffPermissions: string[],
): OrderAction | null {
  const actions = getAvailableActions(currentStatus, fulfillmentType, staffPermissions);
  return actions.find((a) => a.variant === "primary") ?? null;
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
