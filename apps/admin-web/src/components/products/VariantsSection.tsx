"use client";

import { useState } from "react";
import { createProductVariantSchema } from "@shri-anandam/validation";
import { useAddVariant, useRemoveVariant, useUpdateVariant } from "@/lib/hooks/use-products";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Product } from "@/lib/types";
import { formatInr } from "@/lib/format";

export function VariantsSection({ product }: { product: Product }) {
  const addVariant = useAddVariant(product.id);
  const updateVariant = useUpdateVariant(product.id);
  const removeVariant = useRemoveVariant(product.id);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [priceInPaise, setPriceInPaise] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setSku("");
    setWeightGrams("");
    setPriceInPaise("");
    setError(null);
    setShowForm(false);
  };

  const handleAdd = () => {
    const result = createProductVariantSchema.safeParse({
      name,
      sku,
      weightGrams: weightGrams ? Number(weightGrams) : undefined,
      priceInPaise: Number(priceInPaise) * 100,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the variant fields");
      return;
    }
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

      <div className="flex flex-col gap-2">
        {product.variants.map((variant) => (
          <div key={variant.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <div>
              <p className="font-semibold text-text">
                {variant.name} <span className="font-normal text-text-muted">({variant.sku})</span>
              </p>
              <p className="text-text-muted">
                {formatInr(variant.priceInPaise)}
                {variant.weightGrams ? ` · ${variant.weightGrams}g` : ""}
                {!variant.isActive ? " · inactive" : ""}
              </p>
            </div>
            <div className="flex gap-2">
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
        ))}
        {product.variants.length === 0 ? <p className="text-sm text-text-muted">No variants yet.</p> : null}
      </div>

      {showForm ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="250g" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="SKU" placeholder="KK-250G" value={sku} onChange={(e) => setSku(e.target.value)} />
            <Input label="Weight (grams, optional)" type="number" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} />
            <Input label="Price (₹)" type="number" value={priceInPaise} onChange={(e) => setPriceInPaise(e.target.value)} />
          </div>
          {error ? <ErrorBlock message={error} /> : null}
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetForm} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleAdd} loading={addVariant.isPending} className="flex-1" disabled={!name || !sku || !priceInPaise}>
              Save Variant
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
