"use client";

import { useState } from "react";
import { createProductVariantSchema } from "@shri-anandam/validation";
import { useAddVariant, useAssignVariantBranches, useRemoveVariant, useUpdateVariant } from "@/lib/hooks/use-products";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Product, ProductUnit } from "@/lib/types";
import { formatInr } from "@/lib/format";

const UNIT_OPTIONS: { value: ProductUnit; label: string }[] = [
  { value: "PIECE", label: "Piece" },
  { value: "PLATE", label: "Plate" },
  { value: "HALF_PLATE", label: "Half Plate" },
  { value: "FULL_PLATE", label: "Full Plate" },
  { value: "GRAM", label: "Gram" },
  { value: "KILOGRAM", label: "Kilogram" },
  { value: "ML", label: "ml" },
  { value: "LITRE", label: "Litre" },
  { value: "BOX", label: "Box" },
  { value: "PACKET", label: "Packet" },
];

const UNIT_LABEL = new Map(UNIT_OPTIONS.map((u) => [u.value, u.label]));

export function VariantsSection({ product }: { product: Product }) {
  const addVariant = useAddVariant(product.id);
  const updateVariant = useUpdateVariant(product.id);
  const removeVariant = useRemoveVariant(product.id);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("PIECE");
  const [quantity, setQuantity] = useState("1");
  const [weightGrams, setWeightGrams] = useState("");
  const [priceTbd, setPriceTbd] = useState(false);
  const [priceInPaise, setPriceInPaise] = useState("");
  const [compareAtPriceInPaise, setCompareAtPriceInPaise] = useState("");
  const [gstRatePercent, setGstRatePercent] = useState("");
  const [minOrderQuantity, setMinOrderQuantity] = useState("1");
  const [maxOrderQuantity, setMaxOrderQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setSku("");
    setUnit("PIECE");
    setQuantity("1");
    setWeightGrams("");
    setPriceTbd(false);
    setPriceInPaise("");
    setCompareAtPriceInPaise("");
    setGstRatePercent("");
    setMinOrderQuantity("1");
    setMaxOrderQuantity("");
    setError(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    const result = createProductVariantSchema.safeParse({
      name,
      sku,
      unit,
      quantity: Number(quantity),
      weightGrams: weightGrams ? Number(weightGrams) : undefined,
      priceInPaise: priceTbd || !priceInPaise ? undefined : Math.round(Number(priceInPaise) * 100),
      compareAtPriceInPaise: compareAtPriceInPaise ? Math.round(Number(compareAtPriceInPaise) * 100) : undefined,
      gstRatePercent: gstRatePercent ? Number(gstRatePercent) : undefined,
      minOrderQuantity: Number(minOrderQuantity),
      maxOrderQuantity: maxOrderQuantity ? Number(maxOrderQuantity) : undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the variant fields");
      return;
    }
    setError(null);
    addVariant.mutate(result.data, { onSuccess: resetForm, onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add variant.") });
  };

  return (
    <Card>
      <CardHeader
        title="Variants"
        action={
          !showForm ? (
            <Button variant="outline" onClick={() => setShowForm(true)}>
              Add Variant
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        {product.variants.map((variant) => (
          <VariantRow key={variant.id} productId={product.id} variant={variant} updateVariant={updateVariant} removeVariant={removeVariant} />
        ))}
        {product.variants.length === 0 ? <p className="text-sm text-text-muted">No variants yet.</p> : null}
      </div>

      {showForm ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Half Plate, 250g, ..." value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="SKU" placeholder="MOMO-VEG-HALF" value={sku} onChange={(e) => setSku(e.target.value)} />
            <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Input label="Quantity (in that unit)" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input label="Weight in grams (optional)" type="number" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
            <div className="flex flex-col gap-1">
              <Input
                label="Price (₹)"
                type="number"
                value={priceInPaise}
                onChange={(e) => setPriceInPaise(e.target.value)}
                disabled={priceTbd}
              />
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input type="checkbox" className="size-3.5" checked={priceTbd} onChange={(e) => setPriceTbd(e.target.checked)} />
                Price not decided yet (TBD)
              </label>
            </div>
            <Input label="Compare-at price (₹, optional)" type="number" value={compareAtPriceInPaise} onChange={(e) => setCompareAtPriceInPaise(e.target.value)} />
            <Input label="GST rate % (optional)" type="number" step="any" value={gstRatePercent} onChange={(e) => setGstRatePercent(e.target.value)} />
            <Input label="Min order quantity" type="number" min="1" value={minOrderQuantity} onChange={(e) => setMinOrderQuantity(e.target.value)} />
            <Input label="Max order quantity (optional)" type="number" min="1" value={maxOrderQuantity} onChange={(e) => setMaxOrderQuantity(e.target.value)} />
          </div>
          {error ? <ErrorBlock message={error} /> : null}
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetForm} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={addVariant.isPending} className="flex-1" disabled={!name || !sku}>
              Save Variant
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function VariantRow({
  productId,
  variant,
  updateVariant,
  removeVariant,
}: {
  productId: string;
  variant: Product["variants"][number];
  updateVariant: ReturnType<typeof useUpdateVariant>;
  removeVariant: ReturnType<typeof useRemoveVariant>;
}) {
  const [showBranches, setShowBranches] = useState(false);
  const { data: branches } = useBranches({ isActive: true });
  const assignVariantBranches = useAssignVariantBranches(productId);
  const assignedIds = new Set(variant.branchVariants.map((bv) => bv.branchId));
  // No rows at all = available everywhere the product itself is sold
  // (see BranchProductVariant's schema comment) — the UI reflects that
  // by showing every branch checked when nothing has been explicitly
  // restricted yet.
  const isRestricted = variant.branchVariants.length > 0;

  const toggleBranch = (branchId: string) => {
    const next = new Set(assignedIds);
    if (!isRestricted) {
      // First-ever restriction: start from "every branch except the one
      // just unchecked" rather than an empty set, matching "available
      // everywhere by default."
      for (const b of branches?.items ?? []) next.add(b.id);
    }
    if (next.has(branchId)) next.delete(branchId);
    else next.add(branchId);
    assignVariantBranches.mutate({ variantId: variant.id, branchIds: Array.from(next) });
  };

  return (
    <div className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text">
            {variant.name} <span className="font-normal text-text-muted">({variant.sku})</span>
          </p>
          <p className="text-text-muted">
            {variant.priceInPaise === null ? <span className="font-semibold text-warning">Price TBD</span> : formatInr(variant.priceInPaise)}
            {" · "}
            {variant.quantity} {UNIT_LABEL.get(variant.unit) ?? variant.unit}
            {variant.weightGrams ? ` (${variant.weightGrams}g)` : ""}
            {variant.gstRatePercent ? ` · GST ${variant.gstRatePercent}%` : ""}
            {variant.minOrderQuantity > 1 || variant.maxOrderQuantity ? ` · qty ${variant.minOrderQuantity}–${variant.maxOrderQuantity ?? "∞"}` : ""}
            {!variant.isActive ? " · inactive" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowBranches((s) => !s)}>
            Branches
          </Button>
          <Button
            variant="ghost"
            onClick={() => updateVariant.mutate({ variantId: variant.id, dto: { isActive: !variant.isActive } })}
          >
            {variant.isActive ? "Deactivate" : "Activate"}
          </Button>
          {variant.isActive ? (
            <Button variant="ghost" className="text-danger" onClick={() => removeVariant.mutate(variant.id)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {showBranches ? (
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
          <p className="mb-1 text-xs text-text-muted">
            {isRestricted ? "Available only where checked:" : "Available at every branch the product is sold at — check a box to restrict:"}
          </p>
          {branches?.items.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-3.5"
                checked={isRestricted ? assignedIds.has(branch.id) : true}
                onChange={() => toggleBranch(branch.id)}
              />
              {branch.name} <span className="text-text-muted">({branch.code})</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
