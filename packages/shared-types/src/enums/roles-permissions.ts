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

  // Also not in section 34's original list, same reason as
  // ORGANIZATION_*/BRANCH_*/ROLE_MANAGE below: the admin panel's
  // Customers screen (Phase 9) needs an admin-facing "look up any
  // customer" capability distinct from a customer reading their own
  // profile (which needs no permission at all — see CustomersController,
  // scoped to the caller's own id by construction). CUSTOMER_UPDATE is
  // narrow by design — deactivating a customer account, not editing
  // their profile fields on their behalf.
  CUSTOMER_READ: "customer.read",
  CUSTOMER_UPDATE: "customer.update",

  REPORT_READ: "report.read",

  AUDIT_READ: "audit.read",

  // Not in the brief's original permission list (section 34) — added in
  // Phase 2 because the admin panel's Branches/Organization/Roles screens
  // (section 25) need their own enforcement points. ORGANIZATION_UPDATE
  // and ROLE_MANAGE are deliberately kept out of MANAGER's default grant
  // below: changing org identity or what a role is allowed to do is
  // owner-level, not day-to-day branch management.
  ORGANIZATION_READ: "organization.read",
  ORGANIZATION_UPDATE: "organization.update",

  BRANCH_READ: "branch.read",
  BRANCH_CREATE: "branch.create",
  BRANCH_UPDATE: "branch.update",
  BRANCH_DELETE: "branch.delete",

  /**
   * Coupons affect revenue directly (discount math applied at checkout),
   * so they get their own permission rather than piggybacking on
   * PRODUCT_* the way addons do — a role that can edit the menu
   * shouldn't automatically be able to create discount codes.
   */
  COUPON_READ: "coupon.read",
  COUPON_CREATE: "coupon.create",
  COUPON_UPDATE: "coupon.update",
  COUPON_DELETE: "coupon.delete",

  /** Edit which permissions a Role grants (role_permissions) — distinct from staff.update (editing one staff member's own roles/branches/profile). */
  ROLE_MANAGE: "role.manage",
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
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_UPDATE,
    Permission.REPORT_READ,
    Permission.AUDIT_READ,
    Permission.ORGANIZATION_READ,
    Permission.BRANCH_READ,
    Permission.BRANCH_CREATE,
    Permission.BRANCH_UPDATE,
    Permission.COUPON_READ,
    Permission.COUPON_CREATE,
    Permission.COUPON_UPDATE,
    Permission.COUPON_DELETE,
  ],
  [Role.CASHIER]: [
    Permission.ORDER_READ,
    Permission.ORDER_ACCEPT,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_COLLECT,
    Permission.BRANCH_READ,
  ],
  [Role.KITCHEN]: [
    Permission.ORDER_READ,
    Permission.ORDER_ACCEPT,
    Permission.INVENTORY_READ,
    Permission.BRANCH_READ,
  ],
  [Role.SUPPORT]: [
    Permission.ORDER_READ,
    Permission.ORDER_CANCEL,
    Permission.PAYMENT_READ,
    Permission.CUSTOMER_READ,
    Permission.BRANCH_READ,
  ],
  [Role.ACCOUNTANT]: [
    Permission.PAYMENT_READ,
    Permission.PAYMENT_REFUND,
    Permission.REPORT_READ,
    Permission.AUDIT_READ,
    Permission.BRANCH_READ,
  ],
};
