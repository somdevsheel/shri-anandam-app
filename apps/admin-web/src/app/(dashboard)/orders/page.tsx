"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OrderStatus } from "@shri-anandam/shared-types";
import { useOrders } from "@/lib/hooks/use-orders";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime, formatInr } from "@/lib/format";

const STATUS_OPTIONS = ["", ...Object.values(OrderStatus)];

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useOrders({ status: status || undefined, page, pageSize: 20 });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Orders</h1>
        <div className="w-48">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load orders." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No orders found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-background/50">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                        #{order.orderNumber}
                      </Link>
                      <p className="text-xs text-text-muted">{order.fulfillmentType}</p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{order.branch.name}</td>
                    <td className="px-4 py-3">
                      <Badge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={order.paymentStatus} />
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatInr(order.totalInPaise)}</td>
                    <td className="px-4 py-3 text-text-muted">{formatDateTime(order.placedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? (
          <div className="px-4 py-3">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
