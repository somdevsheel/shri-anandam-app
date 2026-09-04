import type { Paise } from "@shri-anandam/shared-types";

/**
 * The subset of services/api's order response shape this app actually
 * displays — a kitchen screen has no reason to render payment provider
 * ids or a customer's saved address, so those fields aren't modeled
 * here at all (the real API response has more; this is just what's
 * read). Hand-written against the verified API response, same approach
 * as every other frontend in this repo.
 */

export interface OrderItemAddon {
  id: string;
  addonNameSnapshot: string;
}

export interface OrderItem {
  id: string;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  quantity: number;
  specialInstructions: string | null;
  addons: OrderItemAddon[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  newStatus: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  placedAt: string;
  totalInPaise: Paise;
  branch: { id: string; name: string; code: string };
  items: OrderItem[];
  statusHistory: OrderStatusHistoryEntry[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
