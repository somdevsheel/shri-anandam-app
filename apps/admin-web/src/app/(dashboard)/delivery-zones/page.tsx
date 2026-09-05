"use client";

import { useState } from "react";
import { createDeliveryZoneSchema } from "@shri-anandam/validation";
import { useCreateDeliveryZone, useDeactivateDeliveryZone, useDeliveryZones } from "@/lib/hooks/use-delivery-zones";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { ApiError } from "@/lib/api-client";
import { formatInr } from "@/lib/format";

export default function DeliveryZonesPage() {
  const { data: branches } = useBranches({ isActive: true });
  const { data, isLoading, error } = useDeliveryZones({ pageSize: 100 });
  const createZone = useCreateDeliveryZone();
  const deactivateZone = useDeactivateDeliveryZone();

  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [pincodes, setPincodes] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = () => {
    const result = createDeliveryZoneSchema.safeParse({
      branchId,
      name,
      pincodes: pincodes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      minOrderInPaise: minOrder ? Math.round(Number(minOrder) * 100) : undefined,
      deliveryFeeInPaise: Math.round(Number(deliveryFee) * 100),
      freeDeliveryThresholdInPaise: freeDeliveryThreshold ? Math.round(Number(freeDeliveryThreshold) * 100) : undefined,
    });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Check the delivery zone fields");
      return;
    }
    setFormError(null);
    createZone.mutate(result.data, {
      onSuccess: () => {
        setName("");
        setPincodes("");
        setMinOrder("");
        setDeliveryFee("");
        setFreeDeliveryThreshold("");
      },
      onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not create delivery zone."),
    });
  };

  const branchName = (id: string) => branches?.items.find((b) => b.id === id)?.name ?? id;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Delivery Zones</h1>
      <p className="mt-1 text-sm text-text-muted">
        Every DELIVERY order is checked against these at checkout — an address whose PIN code isn&apos;t covered by any
        active zone for its branch is rejected with &quot;we don&apos;t deliver to this address yet.&quot;
      </p>

      <Card className="mt-6">
        <CardHeader title="New zone" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select a branch</option>
            {(branches?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Zone name" placeholder="Civil Lines" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="PIN codes"
            hint="Comma-separated, 6 digits each"
            placeholder="208001, 208002"
            value={pincodes}
            onChange={(e) => setPincodes(e.target.value)}
          />
          <Input label="Delivery fee (₹)" type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          <Input label="Min order for delivery (₹, optional)" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          <Input
            label="Free delivery above (₹, optional)"
            type="number"
            value={freeDeliveryThreshold}
            onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
          />
        </div>

        {formError ? (
          <div className="mt-3">
            <ErrorBlock message={formError} />
          </div>
        ) : null}

        <Button className="mt-4" onClick={handleCreate} loading={createZone.isPending} disabled={!branchId || !name || !pincodes || !deliveryFee}>
          Create zone
        </Button>
      </Card>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Couldn't load delivery zones." />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No delivery zones yet" message="Delivery orders will fail until at least one zone covers the customer's PIN code." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">PIN codes</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((zone) => (
                <tr key={zone.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold text-text">{zone.name}</td>
                  <td className="px-4 py-3 text-text-muted">{branchName(zone.branchId)}</td>
                  <td className="px-4 py-3 text-text-muted">{zone.pincodes.join(", ")}</td>
                  <td className="px-4 py-3 text-text">
                    {formatInr(zone.deliveryFeeInPaise)}
                    {zone.freeDeliveryThresholdInPaise ? ` (free above ${formatInr(zone.freeDeliveryThresholdInPaise)})` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={zone.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {zone.isActive ? (
                      <Button variant="danger" onClick={() => deactivateZone.mutate(zone.id)} loading={deactivateZone.isPending}>
                        Deactivate
                      </Button>
                    ) : null}
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
