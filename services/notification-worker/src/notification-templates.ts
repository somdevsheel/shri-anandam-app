import type { PushNotification } from "./providers/notification-provider.interface";

const ORDER_CHANNEL_ID = "new_orders"; // Android high-priority channel (section 20) — owner app creates this channel on launch.

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** section 20's exact format: "NEW ORDER #SA-20260829-1025 ₹1,250 6 Items Tap to view" */
export function newOrderNotification(orderId: string, orderNumber: string, totalInPaise: number, itemCount: number): PushNotification {
  return {
    title: `NEW ORDER #${orderNumber}`,
    body: `${formatInr(totalInPaise)} · ${itemCount} Item${itemCount === 1 ? "" : "s"} · Tap to view`,
    data: { type: "ORDER", orderId, entityType: "Order" },
    androidChannelId: ORDER_CHANNEL_ID,
  };
}

const ORDER_STATUS_COPY: Record<string, { title: string; body: (orderNumber: string) => string }> = {
  OrderAccepted: { title: "Order Confirmed", body: (n) => `Your order #${n} has been accepted and will be prepared shortly.` },
  OrderPreparing: { title: "Preparing your order", body: (n) => `Order #${n} is being prepared.` },
  OrderReady: { title: "Order Ready", body: (n) => `Order #${n} is ready.` },
  OrderOutForDelivery: { title: "Out for Delivery", body: (n) => `Order #${n} is on its way to you.` },
  OrderDelivered: { title: "Delivered", body: (n) => `Order #${n} has been delivered. Enjoy!` },
  OrderCancelled: { title: "Order Cancelled", body: (n) => `Order #${n} has been cancelled.` },
  OrderRejected: { title: "Order Rejected", body: (n) => `Order #${n} could not be accepted.` },
};

export function orderStatusNotification(eventType: string, orderId: string, orderNumber: string): PushNotification | null {
  const copy = ORDER_STATUS_COPY[eventType];
  if (!copy) return null;
  return { title: copy.title, body: copy.body(orderNumber), data: { type: "ORDER", orderId, entityType: "Order" } };
}

export function paymentNotification(eventType: "PaymentSucceeded" | "PaymentFailed", orderId: string, orderNumber: string): PushNotification {
  return eventType === "PaymentSucceeded"
    ? {
        title: "Payment Received",
        body: `Payment for order #${orderNumber} was successful.`,
        data: { type: "ORDER", orderId, entityType: "Order" },
      }
    : {
        title: "Payment Failed",
        body: `Payment for order #${orderNumber} could not be completed. Please try again.`,
        data: { type: "ORDER", orderId, entityType: "Order" },
      };
}

export function lowStockNotification(inventoryItemId: string, productName: string): PushNotification {
  return {
    title: "Low Stock Alert",
    body: `${productName} is running low — restock soon.`,
    data: { type: "INVENTORY", inventoryItemId, entityType: "InventoryItem" },
    androidChannelId: ORDER_CHANNEL_ID,
  };
}
