"use client";

import { useState } from "react";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { useAssignProductBranches } from "@/lib/hooks/use-products";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorBlock } from "@/components/ui/Feedback";
import { ApiError } from "@/lib/api-client";
import type { Product } from "@/lib/types";

export function BranchesSection({ product }: { product: Product }) {
  const { data: branches } = useBranches({ isActive: true });
  const assignBranches = useAssignProductBranches(product.id);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(product.branchProducts.map((bp) => bp.branchId));

  const toggle = (branchId: string) => {
    const next = new Set(assignedIds);
    if (next.has(branchId)) next.delete(branchId);
    else next.add(branchId);
    setError(null);
    assignBranches.mutate(
      { branchIds: Array.from(next) },
      { onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update branch availability.") },
    );
  };

  return (
    <Card>
      <CardHeader title="Available at Branches" />
      {error ? (
        <div className="mb-3">
          <ErrorBlock message={error} />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {branches?.items.map((branch) => (
          <label key={branch.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input type="checkbox" className="size-4" checked={assignedIds.has(branch.id)} onChange={() => toggle(branch.id)} />
            {branch.name} <span className="text-text-muted">({branch.code})</span>
          </label>
        ))}
      </div>
    </Card>
  );
}
