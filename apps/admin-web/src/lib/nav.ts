import { Permission } from "@shri-anandam/shared-types";

export interface NavItem {
  href: string;
  label: string;
  /** null = always visible to any signed-in staff member (e.g. Dashboard). */
  permission: string | null;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", permission: null },
  { href: "/orders", label: "Orders", permission: Permission.ORDER_READ },
  { href: "/products", label: "Products", permission: Permission.PRODUCT_READ },
  { href: "/coupons", label: "Coupons", permission: Permission.COUPON_READ },
  { href: "/inventory", label: "Inventory", permission: Permission.INVENTORY_READ },
  { href: "/customers", label: "Customers", permission: Permission.CUSTOMER_READ },
  { href: "/staff", label: "Staff", permission: Permission.STAFF_READ },
  { href: "/roles", label: "Roles & Permissions", permission: Permission.STAFF_READ },
  { href: "/reports", label: "Reports", permission: Permission.REPORT_READ },
];
