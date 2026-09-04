"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@shri-anandam/shared-types";
import type { Order } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import { useUpdateOrderStatus } from "@/lib/hooks/use-orders";
import { getPrimaryAction } from "@/lib/order-actions";
import { formatElapsedFromMinutes, getElapsedMinutes } from "@/lib/format";
import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<string, string> = {
  [OrderStatus.PENDING]: "New",
  [OrderStatus.ACCEPTED]: "Accepted",
  [OrderStatus.PREPARING]: "Preparing",
  [OrderStatus.READY]: "Ready",
  [OrderStatus.OUT_FOR_DELIVERY]: "Out for Delivery",
};

const STATUS_BORDER: Record<string, string> = {
  [OrderStatus.PENDING]: "border-warning",
  [OrderStatus.ACCEPTED]: "border-info",
  [OrderStatus.PREPARING]: "border-info",
  [OrderStatus.READY]: "border-success",
  [OrderStatus.OUT_FOR_DELIVERY]: "border-success",
};

/** Past this, an order's elapsed-time badge turns from neutral to a "this is taking too long" red — a plain, honest heuristic (not configurable per branch/product yet) rather than no signal at all. */
const OVERDUE_MINUTES = 20;

export function OrderCard({ order }: { order: Order }) {
  const router = useRouter();
  const permissions = useAuthStore((s) => s.staff?.permissions ?? []);
  const updateStatus = useUpdateOrderStatus(order.id);
  // Computed together and only ever updated from the interval callback
  // (an effect, not render) — `Date.now()` never runs during render
  // itself, which React's purity rule requires.
  const [elapsedMinutes, setElapsedMinutes] = useState(() => getElapsedMinutes(order.placedAt));

  useEffect(() => {
    // Only a ticking timer — the initial value already comes from the
    // lazy useState initializer above, and `order.placedAt` never
    // changes for a given order.id (this card is always rendered with
    // key={order.id} by the queue page), so there's nothing to
    // resynchronize here on mount, only on each tick.
    const interval = setInterval(() => setElapsedMinutes(getElapsedMinutes(order.placedAt)), 15_000);
    return () => clearInterval(interval);
  }, [order.placedAt]);

  const primaryAction = getPrimaryAction(order.status as OrderStatus, order.fulfillmentType, permissions);
  const isOverdue = elapsedMinutes > OVERDUE_MINUTES;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border-4 bg-surface p-4 shadow-sm ${STATUS_BORDER[order.status] ?? "border-border"}`}>
      <button onClick={() => router.push(`/order/${order.id}`)} className="text-left">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-text">#{order.orderNumber}</p>
            <p className="text-lg font-semibold text-text-muted">{STATUS_LABEL[order.status] ?? order.status}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-lg font-bold ${isOverdue ? "bg-danger/15 text-danger" : "bg-border/60 text-text-muted"}`}>
            {formatElapsedFromMinutes(elapsedMinutes)}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {order.items.map((item) => (
            <p key={item.id} className="text-lg text-text">
              <span className="font-bold">{item.quantity}×</span> {item.productNameSnapshot}{" "}
              <span className="text-text-muted">({item.variantNameSnapshot})</span>
              {item.specialInstructions ? (
                <span className="block text-base italic text-danger">&ldquo;{item.specialInstructions}&rdquo;</span>
              ) : null}
            </p>
          ))}
        </div>

        <p className="mt-2 text-base text-text-muted">
          {itemCount} item{itemCount === 1 ? "" : "s"} · {order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}
        </p>
      </button>

      {primaryAction ? (
        <Button onClick={() => updateStatus.mutate({ status: primaryAction.status })} loading={updateStatus.isPending} className="w-full">
          {primaryAction.label}
        </Button>
      ) : null}
    </div>
  );
}
