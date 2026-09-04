"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdjustInventory, useInventory, useRecordWastage, useRestockInventory } from "@/lib/hooks/use-inventory";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api-client";
import type { InventoryItem } from "@/lib/types";

type ActionKind = "restock" | "adjust" | "wastage";

export default function InventoryPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <InventoryPageContent />
    </Suspense>
  );
}

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const [branchId, setBranchId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get("lowStockOnly") === "true");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ kind: ActionKind; item: InventoryItem } | null>(null);

  const { data: branches } = useBranches();
  const { data, isLoading, error } = useInventory({ branchId: branchId || undefined, lowStockOnly: lowStockOnly || undefined, page });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Inventory</h1>
      </div>

      <div className="mb-4 mt-4 flex items-center gap-3">
        <div className="w-56">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" className="size-4" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load inventory." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No inventory items found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const isLow = Number(item.stockQuantity) <= Number(item.lowStockThreshold);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-background/50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text">{item.productVariant.product.name}</p>
                        <p className="text-xs text-text-muted">
                          {item.productVariant.name} · {item.productVariant.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{item.branch.name}</td>
                      <td className="px-4 py-3">
                        <span className={isLow ? "font-semibold text-danger" : "text-text"}>
                          {item.stockQuantity} {item.unit === "GRAM" ? "g" : "pc"}
                        </span>
                        {isLow ? <Badge status="INACTIVE" label="Low stock" /> : null}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {item.lowStockThreshold} {item.unit === "GRAM" ? "g" : "pc"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setAction({ kind: "restock", item })}>
                            Restock
                          </Button>
                          <Button variant="ghost" onClick={() => setAction({ kind: "adjust", item })}>
                            Adjust
                          </Button>
                          <Button variant="ghost" className="text-danger" onClick={() => setAction({ kind: "wastage", item })}>
                            Wastage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {action ? <InventoryActionModal kind={action.kind} item={action.item} onClose={() => setAction(null)} /> : null}
    </div>
  );
}

function InventoryActionModal({ kind, item, onClose }: { kind: ActionKind; item: InventoryItem; onClose: () => void }) {
  const restock = useRestockInventory(item.id);
  const adjust = useAdjustInventory(item.id);
  const wastage = useRecordWastage(item.id);

  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const titles: Record<ActionKind, string> = { restock: "Restock", adjust: "Adjust Stock", wastage: "Record Wastage" };
  const unitLabel = item.unit === "GRAM" ? "grams" : "pieces";

  const handleSubmit = () => {
    const qty = Number(quantity);
    if (kind === "restock") {
      if (!(qty > 0)) return setError("Enter a positive quantity");
      setError(null);
      restock.mutate({ quantity: qty, note: note || undefined }, { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : "Could not restock.") });
    } else if (kind === "adjust") {
      if (qty === 0 || Number.isNaN(qty)) return setError("Enter a non-zero delta (positive or negative)");
      if (!note.trim()) return setError("A reason is required for adjustments");
      setError(null);
      adjust.mutate({ quantityDelta: qty, reason: note.trim() }, { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : "Could not adjust stock.") });
    } else {
      if (!(qty > 0)) return setError("Enter a positive quantity");
      if (!note.trim()) return setError("A reason is required for wastage");
      setError(null);
      wastage.mutate({ quantity: qty, reason: note.trim() }, { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : "Could not record wastage.") });
    }
  };

  const isPending = restock.isPending || adjust.isPending || wastage.isPending;

  return (
    <Modal title={`${titles[kind]} — ${item.productVariant.product.name} (${item.productVariant.name})`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label={kind === "adjust" ? `Delta (${unitLabel}, +/-)` : `Quantity (${unitLabel})`}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Input
          label={kind === "restock" ? "Note (optional)" : "Reason"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? <ErrorBlock message={error} /> : null}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} loading={isPending}>
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}
