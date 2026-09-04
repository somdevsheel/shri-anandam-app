import type { Paise } from "@shri-anandam/shared-types";

/**
 * Response shapes returned by services/api's orders/notifications/devices
 * endpoints. Hand-written against the actual verified API responses (same
 * approach as apps/customer-mobile/src/api/types.ts — services/api has no
 * generated client yet) and cross-checked live against real curl output
 * during Phase 8 verification.
 */

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface OrderItemAddon {
  id: string;
  orderItemId: string;
  addonId: string | null;
  addonNameSnapshot: string;
  priceInPaiseSnapshot: Paise;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  quantity: number;
  unitPriceInPaise: Paise;
  discountInPaise: Paise;
  taxInPaise: Paise;
  finalPriceInPaise: Paise;
  specialInstructions: string | null;
  addons: OrderItemAddon[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  previousStatus: string | null;
  newStatus: string;
  actorId: string;
  actorType: "CUSTOMER" | "STAFF" | "SYSTEM";
  reason: string | null;
  createdAt: string;
}

export interface OrderNote {
  id: string;
  orderId: string;
  staffId: string;
  note: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  type: string;
  amountInPaise: Paise;
  status: string;
  createdAt: string;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  provider: string;
  method: string;
  status: string;
  amountInPaise: Paise;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  transactions: PaymentTransaction[];
}

export interface OrderAddressSnapshot {
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  customerId: string;
  status: string;
  paymentStatus: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  scheduledFor: string | null;
  subtotalInPaise: Paise;
  discountInPaise: Paise;
  deliveryFeeInPaise: Paise;
  taxInPaise: Paise;
  totalInPaise: Paise;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; name: string; code: string };
  // The one place this app needs the customer's name/phone: a "call
  // customer" button on the order detail screen (section 19). See
  // ORDER_DETAIL_INCLUDE in services/api/src/orders/orders.service.ts.
  customer: { mobileNumber: string; name: string | null } | null;
  items: OrderItem[];
  addressSnapshot: OrderAddressSnapshot | null;
  statusHistory: OrderStatusHistoryEntry[];
  notes: OrderNote[];
  payments: OrderPayment[];
}

export interface Notification {
  id: string;
  customerId: string | null;
  staffId: string | null;
  deviceId: string | null;
  outboxEventId: string | null;
  channel: string;
  category: string;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "READ";
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface DeviceToken {
  id: string;
  customerId: string | null;
  staffId: string | null;
  fcmToken: string;
  platform: "ANDROID" | "IOS" | "WEB";
  appType: "CUSTOMER" | "OWNER" | "ADMIN" | "KITCHEN";
  isActive: boolean;
  lastActiveAt: string;
  createdAt: string;
}
