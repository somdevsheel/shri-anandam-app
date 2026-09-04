/**
 * RBAC roles and permissions. This is the canonical list consumed by:
 *  - services/api database seed (roles/permissions/role_permissions tables)
 *  - services/api PermissionsGuard (server-side enforcement — the only
 *    place permissions are actually enforced)
 *  - apps/admin-web and apps/kitchen-web (UI hiding only — NEVER a
 *    security boundary on its own)
 *
 * Frontend hiding of a button is a UX nicety. The backend re-checks every
 * permission on every request regardless of what the client sent.
 */
export const Role = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  CASHIER: "CASHIER",
  KITCHEN: "KITCHEN",
  SUPPORT: "SUPPORT",
  ACCOUNTANT: "ACCOUNTANT",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  ORDER_READ: "order.read",
  ORDER_CREATE: "order.create",
  ORDER_ACCEPT: "order.accept",
  ORDER_REJECT: "order.reject",
  ORDER_CANCEL: "order.cancel",
  ORDER_REFUND: "order.refund",

  PRODUCT_READ: "product.read",
  PRODUCT_CREATE: "product.create",
  PRODUCT_UPDATE: "product.update",
  PRODUCT_DELETE: "product.delete",

  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",

  PAYMENT_READ: "payment.read",
  PAYMENT_COLLECT: "payment.collect",
  PAYMENT_REFUND: "payment.refund",

  STAFF_READ: "staff.read",
  STAFF_CREATE: "staff.create",
  STAFF_UPDATE: "staff.update",
  STAFF_DELETE: "staff.delete",

  REPORT_READ: "report.read",

  AUDIT_READ: "audit.read",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Default permission grants per role, seeded at bootstrap. Editable later
 * via the admin "Roles & Permissions" screen (role_permissions table) —
 * this is the initial state, not a hardcoded ceiling.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission),
  [Role.MANAGER]: [
    Permission.ORDER_READ,
    Permission.ORDER_CREATE,
    Permission.ORDER_ACCEPT,
    Permission.ORDER_REJECT,
    Permission.ORDER_CANCEL,
    Permission.ORDER_REFUND,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_ADJUST,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_COLLECT,
    Permission.PAYMENT_REFUND,
    Permission.STAFF_READ,
    Permission.STAFF_CREATE,
    Permission.STAFF_UPDATE,
    Permission.REPORT_READ,
    Permission.AUDIT_READ,
  ],
  [Role.CASHIER]: [
    Permission.ORDER_READ,
    Permission.ORDER_ACCEPT,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_COLLECT,
  ],
  [Role.KITCHEN]: [Permission.ORDER_READ, Permission.ORDER_ACCEPT, Permission.INVENTORY_READ],
  [Role.SUPPORT]: [Permission.ORDER_READ, Permission.ORDER_CANCEL, Permission.PAYMENT_READ],
  [Role.ACCOUNTANT]: [
    Permission.PAYMENT_READ,
    Permission.PAYMENT_REFUND,
    Permission.REPORT_READ,
    Permission.AUDIT_READ,
  ],
};
