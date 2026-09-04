"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@shri-anandam/shared-types";
import { useOrder, useUpdateOrderStatus } from "@/lib/hooks/use-orders";
import { useAuthStore } from "@/lib/auth-store";
import { getAvailableActions } from "@/lib/order-actions";
import { formatElapsed, formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id);
  const permissions = useAuthStore((s) => s.staff?.permissions ?? []);

  const [pendingAction, setPendingAction] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock />;
  if (error || !order) return <EmptyState title="Couldn't load this order" />;

  const actions = getAvailableActions(order.status as OrderStatus, order.fulfillmentType, permissions);

  const runAction = (status: OrderStatus) => {
    setActionError(null);
    updateStatus.mutate(
      { status },
      {
        onSuccess: () => {
          setPendingAction(null);
          if (status !== order.status) router.back();
        },
        onError: (err) => setActionError(err instanceof ApiError ? err.message : "Please try again."),
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => router.back()} className="mb-4 text-lg font-semibold text-primary">
        ← Back to Queue
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text">#{order.orderNumber}</h1>
          <p className="mt-1 text-xl text-text-muted">
            Placed {formatTime(order.placedAt)} · {formatElapsed(order.placedAt)} ago
          </p>
        </div>
        <span className="rounded-full bg-border/60 px-4 py-2 text-lg font-bold text-text">{order.fulfillmentType}</span>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-border bg-surface p-5">
        <p className="mb-3 text-sm font-bold uppercase tracking-wide text-text-muted">Items</p>
        <div className="flex flex-col gap-4">
          {order.items.map((item) => (
            <div key={item.id} className="border-b-2 border-border pb-3 last:border-0 last:pb-0">
              <p className="text-2xl font-bold text-text">
                {item.quantity}× {item.productNameSnapshot}
              </p>
              <p className="text-lg text-text-muted">{item.variantNameSnapshot}</p>
              {item.addons.map((addon) => (
                <p key={addon.id} className="text-lg text-text-muted">
                  + {addon.addonNameSnapshot}
                </p>
              ))}
              {item.specialInstructions ? (
                <p className="mt-1 text-lg font-semibold text-danger">&ldquo;{item.specialInstructions}&rdquo;</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {actionError ? (
          <div className="mb-4">
            <ErrorBlock message={actionError} />
          </div>
        ) : null}

        {pendingAction ? (
          <div className="flex flex-col gap-3">
            <p className="text-xl font-semibold text-text">Confirm: {pendingAction.label.toLowerCase()} order #{order.orderNumber}?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPendingAction(null)}>
                Back
              </Button>
              <Button variant="danger" className="flex-1" loading={updateStatus.isPending} onClick={() => runAction(pendingAction.status)}>
                Confirm
              </Button>
            </div>
          </div>
        ) : actions.length === 0 ? (
          <p className="text-xl text-text-muted">No actions available for this order.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {actions.map((action) =>
              action.variant === "danger" ? (
                <Button key={action.status} variant="danger" onClick={() => setPendingAction(action)}>
                  {action.label}
                </Button>
              ) : (
                <Button key={action.status} loading={updateStatus.isPending} onClick={() => runAction(action.status)}>
                  {action.label}
                </Button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
