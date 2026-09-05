import type { Paise } from "@shri-anandam/shared-types";

/**
 * Response shapes returned by services/api's catalog/cart/customer
 * endpoints. Hand-written against the actual verified API responses
 * rather than generated — services/api doesn't publish OpenAPI/generated
 * client types yet (that's what the empty packages/api-client is for;
 * section 41 calls for OpenAPI docs as a later addition). Keep these in
 * sync with the backend DTOs by hand until that lands.
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

/** GET /catalog/branches — a narrow public projection, not the full staff-only Branch record. */
export interface PublicBranch {
  id: string;
  name: string;
  phone: string | null;
  address: string;
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

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  weightGrams: string | null;
  unit: ProductUnit;
  quantity: string;
  /** null = "TBD" — no real price set yet. Never orderable while null;
   * the API itself refuses to add a null-priced variant to any cart. */
  priceInPaise: Paise | null;
  compareAtPriceInPaise: Paise | null;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductAddonLink {
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

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CartLineIssue {
  cartItemId: string;
  code: "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE" | "NOT_SOLD_AT_BRANCH" | "INSUFFICIENT_STOCK" | "ADDON_UNAVAILABLE";
  message: string;
}

export interface CartItemLine {
  id: string;
  product: { id: string; name: string; slug: string };
  variant: { id: string; name: string; priceInPaise: Paise };
  addons: { id: string; name: string; priceInPaise: Paise }[];
  quantity: number;
  specialInstructions: string | null;
  unitPriceInPaise: Paise;
  lineTotalInPaise: Paise;
}

export interface CartResponse {
  cart: {
    id: string;
    branchId: string;
    branch: { id: string; name: string; code: string };
    items: CartItemLine[];
  } | null;
  subtotalInPaise: Paise;
  itemCount: number;
  issues: CartLineIssue[];
}

export type CouponPreview =
  | { valid: true; coupon: { id: string; code: string }; discountInPaise: Paise }
  | { valid: false; message: string };

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

export interface CustomerProfile {
  id: string;
  mobileNumber: string;
  email: string | null;
  name: string | null;
  addresses: CustomerAddress[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Orders (Phase 11 — checkout was previously a placeholder; see
// app/checkout.tsx's git history)
// ---------------------------------------------------------------------------

export interface OrderItemAddon {
  id: string;
  addonNameSnapshot: string;
  priceInPaiseSnapshot: Paise;
}

export interface OrderItem {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  quantity: number;
  unitPriceInPaise: Paise;
  finalPriceInPaise: Paise;
  specialInstructions: string | null;
  addons: OrderItemAddon[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  actorType: "CUSTOMER" | "STAFF" | "SYSTEM";
  reason: string | null;
  createdAt: string;
}

export interface OrderPayment {
  id: string;
  provider: string;
  method: string;
  status: string;
  amountInPaise: Paise;
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
  status: string;
  paymentStatus: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  subtotalInPaise: Paise;
  discountInPaise: Paise;
  deliveryFeeInPaise: Paise;
  taxInPaise: Paise;
  totalInPaise: Paise;
  placedAt: string;
  branch: { id: string; name: string; code: string; address: string };
  items: OrderItem[];
  addressSnapshot: OrderAddressSnapshot | null;
  statusHistory: OrderStatusHistoryEntry[];
  payments: OrderPayment[];
}

export interface AppNotification {
  id: string;
  category: string;
  type: string;
  title: string;
  body: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}
