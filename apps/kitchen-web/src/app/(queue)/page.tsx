"use client";

import { useMemo, useState } from "react";
import { OrderStatus } from "@shri-anandam/shared-types";
import { useQueue } from "@/lib/hooks/use-orders";
import { useNewOrderAlert } from "@/lib/hooks/use-new-order-alert";
import { OrderCard } from "@/components/OrderCard";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/Feedback";

type Filter = "ACTIVE" | typeof OrderStatus.PENDING | typeof OrderStatus.PREPARING | typeof OrderStatus.READY;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ACTIVE", label: "All Active" },
  { value: OrderStatus.PENDING, label: "New" },
  { value: OrderStatus.PREPARING, label: "Preparing" },
  { value: OrderStatus.READY, label: "Ready" },
];

export default function QueuePage() {
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const { data: activeOrders, isLoading, error } = useQueue();

  useNewOrderAlert(activeOrders);

  const visibleOrders = useMemo(
    () => (!activeOrders ? [] : filter === "ACTIVE" ? activeOrders : activeOrders.filter((o) => o.status === filter)),
    [activeOrders, filter],
  );

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-xl px-5 py-3 text-lg font-bold transition-colors ${
              filter === f.value ? "bg-primary text-on-primary" : "border-2 border-border bg-surface text-text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message="Couldn't load the order queue. Retrying automatically." />
      ) : visibleOrders.length === 0 ? (
        <EmptyState title="No orders here" message="New orders will appear automatically." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
