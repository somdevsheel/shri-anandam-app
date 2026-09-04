"use client";

import { useState } from "react";
import { useAddons } from "@/lib/hooks/use-catalog-support";
import { useAssignAddons } from "@/lib/hooks/use-products";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorBlock } from "@/components/ui/Feedback";
import { ApiError } from "@/lib/api-client";
import type { Product } from "@/lib/types";
import { formatInr } from "@/lib/format";

export function AddonsSection({ product }: { product: Product }) {
  const { data: addons } = useAddons({ isActive: true });
  const assignAddons = useAssignAddons(product.id);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(product.productAddons.map((pa) => pa.addonId));

  const toggle = (addonId: string) => {
    const next = new Set(assignedIds);
    if (next.has(addonId)) next.delete(addonId);
    else next.add(addonId);
    setError(null);
    assignAddons.mutate({ addonIds: Array.from(next) }, { onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update add-ons.") });
  };

  return (
    <Card>
      <CardHeader title="Add-ons" />
      {error ? (
        <div className="mb-3">
          <ErrorBlock message={error} />
        </div>
      ) : null}
      {!addons || addons.items.length === 0 ? (
        <p className="text-sm text-text-muted">No add-ons exist yet — create one under Products → Add-ons.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {addons.items.map((addon) => (
            <label key={addon.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" className="size-4" checked={assignedIds.has(addon.id)} onChange={() => toggle(addon.id)} />
                {addon.name}
              </span>
              <span className="text-text-muted">{formatInr(addon.priceInPaise)}</span>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}
