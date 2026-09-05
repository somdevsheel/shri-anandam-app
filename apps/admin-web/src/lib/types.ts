import type { Paise } from "@shri-anandam/shared-types";

/**
 * Response shapes returned by services/api. Hand-written against actual
 * verified API responses (same approach as the mobile apps' api/types.ts
 * — services/api has no generated client yet).
 */

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

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
  authorStaffId: string;
  note: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  type: string;
  amountInPaise: Paise;
  collectedByStaffId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amountInPaise: Paise;
  reason: string;
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
  latitude: number | null;
  longitude: number | null;
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
  customer: { mobileNumber: string; name: string | null } | null;
  items: OrderItem[];
  addressSnapshot: OrderAddressSnapshot | null;
  statusHistory: OrderStatusHistoryEntry[];
  notes: OrderNote[];
  payments: OrderPayment[];
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export type ProductUnit =
  | "PIECE"
  | "PLATE"
  | "HALF_PLATE"
  | "FULL_PLATE"
  | "GRAM"
  | "KILOGRAM"
  | "ML"
  | "LITRE"
  | "BOX"
  | "PACKET";

export interface BranchVariantAvailability {
  id: string;
  branchId: string;
  productVariantId: string;
  isActive: boolean;
  branch: Branch;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  weightGrams: string | null;
  unit: ProductUnit;
  quantity: string;
  /** null = "TBD" — no real price set yet, see the backend's own schema comment. */
  priceInPaise: Paise | null;
  compareAtPriceInPaise: Paise | null;
  gstRatePercent: string | null;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  isActive: boolean;
  branchVariants: BranchVariantAvailability[];
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductAddonLink {
  addonId: string;
  addon: { id: string; name: string; priceInPaise: Paise; isActive: boolean };
}

export interface ProductBranchAvailability {
  branchId: string;
  branch: { id: string; name: string; code: string };
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  ingredients: string | null;
  allergens: string[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  isVeg: boolean;
  category: Category;
  variants: ProductVariant[];
  images: ProductImage[];
  productAddons: ProductAddonLink[];
  branchProducts: ProductBranchAvailability[];
}

export interface Addon {
  id: string;
  name: string;
  priceInPaise: Paise;
  isActive: boolean;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface DeliveryZone {
  id: string;
  branchId: string;
  name: string;
  pincodes: string[];
  minOrderInPaise: Paise;
  deliveryFeeInPaise: Paise;
  freeDeliveryThresholdInPaise: Paise | null;
  isActive: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderInPaise: Paise | null;
  maxDiscountInPaise: Paise | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  isFirstOrderOnly: boolean;
  branchId: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  branchId: string;
  productVariantId: string;
  unit: "GRAM" | "PIECE";
  /** Decimal(12,3) serialized as a string over JSON — never parse with parseFloat for arithmetic, display-only here (ADR-006). */
  stockQuantity: string;
  lowStockThreshold: string;
  updatedAt: string;
  createdAt: string;
  branch: { id: string; name: string; code: string };
  productVariant: { id: string; name: string; sku: string; product: { id: string; name: string } };
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  type: string;
  quantityDelta: string;
  referenceOrderId: string | null;
  staffId: string | null;
  note: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerAddress {
  id: string;
  label: string | null;
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  mobileNumber: string;
  email: string | null;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Customer {
  addresses: CustomerAddress[];
  orderCount: number;
  totalSpentInPaise: Paise;
}

// ---------------------------------------------------------------------------
// Staff / Roles
// ---------------------------------------------------------------------------

export interface StaffBranchLink {
  branchId: string;
  branch: { id: string; name: string; code: string };
}

export interface StaffRoleLink {
  roleId: string;
  role: { id: string; name: string; description: string | null };
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  staffRoles: StaffRoleLink[];
  branchStaff: StaffBranchLink[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  rolePermissions?: { permission: { id: string; key: string } }[];
}

export interface PermissionRow {
  id: string;
  key: string;
}

// ---------------------------------------------------------------------------
// Payments / Reports
// ---------------------------------------------------------------------------

export interface Reconciliation {
  dateFrom: string;
  dateTo: string;
  branchId: string | null;
  collectionsByMethod: Record<string, number>;
  totalCollectedInPaise: Paise;
  totalRefundsInPaise: Paise;
  netCollectedInPaise: Paise;
}
