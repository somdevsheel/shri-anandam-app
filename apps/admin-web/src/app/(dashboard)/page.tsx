"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { OrderStatus, Permission } from "@shri-anandam/shared-types";
import { apiRequest } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useAuthStore } from "@/lib/auth-store";

interface OrdersSummary {
  totalItems: number;
}

interface InventorySummary {
  totalItems: number;
}

/**
 * Composed client-side from existing list endpoints' totalItems (no
 * dedicated summary endpoint exists server-side yet) — pending/today's
 * orders count, low-stock item count. Small enough at this scale that a
 * dedicated aggregation endpoint isn't worth adding until it becomes a
 * real cost (see the Reports section for the one place a real
 * server-side aggregate — payment reconciliation — already exists).
 */
export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const staff = useAuthStore((s) => s.staff);

  const pendingOrders = useQuery({
    queryKey: ["dashboard", "pending-orders"],
    queryFn: () => apiRequest<OrdersSummary>("/orders", { query: { status: OrderStatus.PENDING, pageSize: 1 } }),
    enabled: hasPermission(Permission.ORDER_READ),
    refetchInterval: 30_000,
  });

  const todaysOrders = useQuery({
    queryKey: ["dashboard", "todays-orders"],
    queryFn: () =>
      apiRequest<OrdersSummary>("/orders", {
        query: { dateFrom: startOfToday().toISOString(), pageSize: 1 },
      }),
    enabled: hasPermission(Permission.ORDER_READ),
  });

  const lowStock = useQuery({
    queryKey: ["dashboard", "low-stock"],
    queryFn: () => apiRequest<InventorySummary>("/inventory", { query: { lowStockOnly: true, pageSize: 1 } }),
    enabled: hasPermission(Permission.INVENTORY_READ),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Dashboard</h1>
      <p className="mt-1 text-sm text-text-muted">Welcome back, {staff?.email}.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasPermission(Permission.ORDER_READ) ? (
          <>
            <SummaryCard
              title="Pending Orders"
              value={pendingOrders.data?.totalItems}
              loading={pendingOrders.isLoading}
              href="/orders?status=PENDING"
              tone="warning"
            />
            <SummaryCard title="Today's Orders" value={todaysOrders.data?.totalItems} loading={todaysOrders.isLoading} href="/orders" />
          </>
        ) : null}
        {hasPermission(Permission.INVENTORY_READ) ? (
          <SummaryCard title="Low Stock Items" value={lowStock.data?.totalItems} loading={lowStock.isLoading} href="/inventory?lowStockOnly=true" tone="danger" />
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasPermission(Permission.PAYMENT_READ) ? (
          <Card>
            <p className="text-sm font-semibold text-text">Payment Reconciliation</p>
            <p className="mt-1 text-sm text-text-muted">View collections by method and net refunds for any date range.</p>
            <Link href="/reports" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Open Reports →
            </Link>
          </Card>
        ) : null}
        {hasPermission(Permission.PRODUCT_READ) ? (
          <Card>
            <p className="text-sm font-semibold text-text">Catalog</p>
            <p className="mt-1 text-sm text-text-muted">Manage products, variants, pricing, and add-ons.</p>
            <Link href="/products" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Open Products →
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  loading,
  href,
  tone,
}: {
  title: string;
  value: number | undefined;
  loading: boolean;
  href: string;
  tone?: "warning" | "danger";
}) {
  const valueClass = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text";
  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <p className="text-sm font-semibold text-text-muted">{title}</p>
        {loading ? <LoadingBlock /> : <p className={`mt-2 text-3xl font-bold ${valueClass}`}>{value ?? 0}</p>}
      </Card>
    </Link>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
