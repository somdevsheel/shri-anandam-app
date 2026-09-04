"use client";

import { useState } from "react";
import Link from "next/link";
import { createAddonSchema } from "@shri-anandam/validation";
import { useAddons, useCreateAddon, useUpdateAddon } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { SubTabs } from "@/components/SubTabs";
import { ApiError } from "@/lib/api-client";
import { formatInr } from "@/lib/format";

export default function AddonsPage() {
  const { data, isLoading, error } = useAddons({ pageSize: 100 });
  const createAddon = useCreateAddon();
  const updateAddon = useUpdateAddon();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = () => {
    const result = createAddonSchema.safeParse({ name, priceInPaise: Math.round(Number(price) * 100) });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Check the add-on fields");
      return;
    }
    setFormError(null);
    createAddon.mutate(result.data, {
      onSuccess: () => {
        setName("");
        setPrice("");
      },
      onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not create add-on."),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Products</h1>
        <Link href="/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      <SubTabs
        items={[
          { href: "/products", label: "Products" },
          { href: "/products/categories", label: "Categories" },
          { href: "/products/addons", label: "Add-ons" },
        ]}
      />

      <Card className="mb-6">
        <CardHeader title="New Add-on" />
        <div className="flex gap-2">
          <div className="flex-1">
            <Input placeholder="Add-on name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-32">
            <Input placeholder="Price (₹)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Button onClick={handleAdd} loading={createAddon.isPending} disabled={!name || !price}>
            Add
          </Button>
        </div>
        {formError ? (
          <div className="mt-2">
            <ErrorBlock message={formError} />
          </div>
        ) : null}
      </Card>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load add-ons." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No add-ons yet" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((addon) => (
                <tr key={addon.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold text-text">{addon.name}</td>
                  <td className="px-4 py-3 text-text-muted">{formatInr(addon.priceInPaise)}</td>
                  <td className="px-4 py-3">
                    <Badge status={addon.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => updateAddon.mutate({ id: addon.id, dto: { isActive: !addon.isActive } })}>
                      {addon.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
