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

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  weightGrams: string | null;
  priceInPaise: Paise;
  compareAtPriceInPaise: Paise | null;
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
