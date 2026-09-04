export const FulfillmentType = {
  DELIVERY: "DELIVERY",
  PICKUP: "PICKUP",
} as const;
export type FulfillmentType = (typeof FulfillmentType)[keyof typeof FulfillmentType];

export const DeliveryAssignmentStatus = {
  UNASSIGNED: "UNASSIGNED",
  ASSIGNED: "ASSIGNED",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;
export type DeliveryAssignmentStatus =
  (typeof DeliveryAssignmentStatus)[keyof typeof DeliveryAssignmentStatus];

export const NotificationChannel = {
  PUSH: "PUSH",
  EMAIL: "EMAIL",
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationCategory = {
  TRANSACTIONAL: "TRANSACTIONAL",
  MARKETING: "MARKETING",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const DomainEvent = {
  ORDER_CREATED: "OrderCreated",
  ORDER_ACCEPTED: "OrderAccepted",
  ORDER_REJECTED: "OrderRejected",
  ORDER_PREPARING: "OrderPreparing",
  ORDER_READY: "OrderReady",
  ORDER_OUT_FOR_DELIVERY: "OrderOutForDelivery",
  ORDER_DELIVERED: "OrderDelivered",
  ORDER_CANCELLED: "OrderCancelled",
  PAYMENT_CREATED: "PaymentCreated",
  PAYMENT_SUCCEEDED: "PaymentSucceeded",
  PAYMENT_FAILED: "PaymentFailed",
  REFUND_CREATED: "RefundCreated",
  REFUND_COMPLETED: "RefundCompleted",
  INVENTORY_LOW: "InventoryLow",
  PRODUCT_UNAVAILABLE: "ProductUnavailable",
  CUSTOMER_REGISTERED: "CustomerRegistered",
} as const;
export type DomainEvent = (typeof DomainEvent)[keyof typeof DomainEvent];
