"use client";

import { use, useState } from "react";
import type { OrderStatus } from "@shri-anandam/shared-types";
import { useAddOrderNote, useOrder, useUpdateOrderStatus } from "@/lib/hooks/use-orders";
import { useAuthStore } from "@/lib/auth-store";
import { getAvailableActions, type OrderAction } from "@/lib/order-actions";
import { formatDateTime, formatInr } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";

/** Next.js 16: `params` is a Promise — unwrapped with `use()`. See node_modules/next/dist/docs' async Request APIs note. */
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id);
  const addNote = useAddOrderNote(id);
  const permissions = useAuthStore((s) => s.staff?.permissions ?? []);

  const [pendingAction, setPendingAction] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock />;
  if (error || !order) return <EmptyState title="Couldn't load this order" />;

  const actions = getAvailableActions(order.status as OrderStatus, order.fulfillmentType, permissions);

  const runAction = (status: OrderStatus, providedReason?: string) => {
    setActionError(null);
    updateStatus.mutate(
      { status, reason: providedReason || undefined },
      {
        onSuccess: () => setPendingAction(null),
        onError: (err) => setActionError(err instanceof ApiError ? err.message : "Please try again."),
      },
    );
  };

  const handleActionClick = (action: OrderAction) => {
    if (action.variant === "danger" || action.label.includes("Reject") || action.label.includes("Cancel")) {
      setPendingAction(action);
      setReason("");
      return;
    }
    runAction(action.status);
  };

  const submitNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    addNote.mutate({ note: trimmed }, { onSuccess: () => setNoteText("") });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Order #{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-text-muted">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <div className="flex gap-2">
          <Badge status={order.status} />
          <Badge status={order.paymentStatus} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Customer" />
            <p className="font-semibold text-text">{order.customer?.name ?? "Customer"}</p>
            <p className="text-sm text-text-muted">{order.customer?.mobileNumber ?? "No phone on file"}</p>
            {order.fulfillmentType === "DELIVERY" && order.addressSnapshot ? (
              <p className="mt-2 text-sm text-text-muted">
                {order.addressSnapshot.line1}
                {order.addressSnapshot.line2 ? `, ${order.addressSnapshot.line2}` : ""}, {order.addressSnapshot.city},{" "}
                {order.addressSnapshot.state} {order.addressSnapshot.pincode}
              </p>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Pickup at {order.branch.name}</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Items" />
            <div className="flex flex-col gap-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-text">
                      {item.quantity}× {item.productNameSnapshot}
                    </p>
                    <p className="text-sm text-text-muted">{item.variantNameSnapshot}</p>
                    {item.addons.map((addon) => (
                      <p key={addon.id} className="text-xs text-text-muted">
                        + {addon.addonNameSnapshot}
                      </p>
                    ))}
                    {item.specialInstructions ? (
                      <p className="mt-1 text-xs italic text-text-muted">&ldquo;{item.specialInstructions}&rdquo;</p>
                    ) : null}
                  </div>
                  <p className="font-semibold text-text">{formatInr(item.finalPriceInPaise)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
              <TotalsRow label="Subtotal" value={order.subtotalInPaise} />
              {order.discountInPaise > 0 ? <TotalsRow label="Discount" value={-order.discountInPaise} /> : null}
              {order.deliveryFeeInPaise > 0 ? <TotalsRow label="Delivery Fee" value={order.deliveryFeeInPaise} /> : null}
              {order.taxInPaise > 0 ? <TotalsRow label="Tax" value={order.taxInPaise} /> : null}
              <TotalsRow label="Total" value={order.totalInPaise} bold />
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="flex flex-col gap-2">
              {order.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-sm">
                  <span className="text-text">
                    {payment.method} · {payment.status}
                  </span>
                  <span className="font-semibold text-text">{formatInr(payment.amountInPaise)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Status History" />
            <div className="flex flex-col gap-3">
              {order.statusHistory.map((entry) => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-semibold text-text">{entry.newStatus}</p>
                    <p className="text-text-muted">
                      {formatDateTime(entry.createdAt)} · by {entry.actorType.toLowerCase()}
                    </p>
                    {entry.reason ? <p className="mt-0.5 italic text-text-muted">{entry.reason}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Actions" />
            {actionError ? (
              <div className="mb-3">
                <ErrorBlock message={actionError} />
              </div>
            ) : null}
            {pendingAction ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-text-muted">Reason for {pendingAction.label.toLowerCase()} (optional)</p>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why?" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setPendingAction(null)}>
                    Back
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    loading={updateStatus.isPending}
                    onClick={() => runAction(pendingAction.status, reason.trim())}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            ) : actions.length === 0 ? (
              <p className="text-sm text-text-muted">No actions available for this order&apos;s current status.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.status}
                    variant={action.variant}
                    loading={updateStatus.isPending}
                    onClick={() => handleActionClick(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <div className="flex flex-col gap-2">
              {order.notes.map((note) => (
                <div key={note.id} className="border-b border-border pb-2 text-sm last:border-0">
                  <p className="text-text">{note.note}</p>
                  <p className="text-xs text-text-muted">{formatDateTime(note.createdAt)}</p>
                </div>
              ))}
              <div className="mt-1 flex gap-2">
                <div className="flex-1">
                  <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" />
                </div>
                <Button onClick={submitNote} loading={addNote.isPending} disabled={!noteText.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TotalsRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-text" : "text-text-muted"}`}>
      <span>{label}</span>
      <span>{formatInr(value)}</span>
    </div>
  );
}
