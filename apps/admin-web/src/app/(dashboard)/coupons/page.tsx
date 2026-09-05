"use client";

import { useState } from "react";
import { createCouponSchema } from "@shri-anandam/validation";
import { useCoupons, useCreateCoupon, useDeactivateCoupon } from "@/lib/hooks/use-coupons";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatInr } from "@/lib/format";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIsoDate(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
}

export default function CouponsPage() {
  const { data, isLoading, error } = useCoupons({ pageSize: 100 });
  const { data: branches } = useBranches({ isActive: true });
  const createCoupon = useCreateCoupon();
  const deactivateCoupon = useDeactivateCoupon();

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("");
  const [isFirstOrderOnly, setIsFirstOrderOnly] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [startsAt, setStartsAt] = useState(todayIsoDate());
  const [endsAt, setEndsAt] = useState(plusDaysIsoDate(30));
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = () => {
    const result = createCouponSchema.safeParse({
      code,
      type,
      value: type === "PERCENTAGE" ? Number(value) : Math.round(Number(value) * 100),
      minOrderInPaise: minOrder ? Math.round(Number(minOrder) * 100) : undefined,
      maxDiscountInPaise: maxDiscount ? Math.round(Number(maxDiscount) * 100) : undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
      perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : undefined,
      isFirstOrderOnly,
      branchId: branchId || undefined,
      startsAt: new Date(startsAt),
      endsAt: new Date(`${endsAt}T23:59:59`),
    });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? "Check the coupon fields");
      return;
    }
    setFormError(null);
    createCoupon.mutate(result.data, {
      onSuccess: () => {
        setCode("");
        setValue("");
        setMinOrder("");
        setMaxDiscount("");
        setUsageLimit("");
        setPerCustomerLimit("");
        setIsFirstOrderOnly(false);
        setBranchId("");
      },
      onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not create coupon."),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Coupons</h1>

      <Card className="mt-6">
        <CardHeader title="New coupon" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input label="Code" placeholder="DIWALI10" value={code} onChange={(e) => setCode(e.target.value)} />
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED")}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </Select>
          <Input
            label={type === "PERCENTAGE" ? "Value (%)" : "Value (₹)"}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input label="Min order (₹, optional)" type="number" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          <Input
            label="Max discount (₹, optional)"
            type="number"
            hint={type === "FIXED" ? "Not used for fixed-amount coupons" : undefined}
            value={maxDiscount}
            onChange={(e) => setMaxDiscount(e.target.value)}
          />
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {(branches?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Usage limit (optional)" type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />
          <Input
            label="Per-customer limit (optional)"
            type="number"
            value={perCustomerLimit}
            onChange={(e) => setPerCustomerLimit(e.target.value)}
          />
          <Input label="Starts" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input label="Ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isFirstOrderOnly} onChange={(e) => setIsFirstOrderOnly(e.target.checked)} className="size-4" />
          First-time customers only
        </label>

        {formError ? (
          <div className="mt-3">
            <ErrorBlock message={formError} />
          </div>
        ) : null}

        <Button className="mt-4" onClick={handleCreate} loading={createCoupon.isPending} disabled={!code || !value}>
          Create coupon
        </Button>
      </Card>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Couldn't load coupons." />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No coupons yet" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Limits</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold text-text">{coupon.code}</td>
                  <td className="px-4 py-3 text-text">
                    {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatInr(coupon.value)}
                    {coupon.maxDiscountInPaise ? ` (up to ${formatInr(coupon.maxDiscountInPaise)})` : ""}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatDate(coupon.startsAt)} – {formatDate(coupon.endsAt)}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {coupon.usageLimit ? `${coupon.usageLimit} total` : "No limit"}
                    {coupon.perCustomerLimit ? `, ${coupon.perCustomerLimit}/customer` : ""}
                    {coupon.isFirstOrderOnly ? ", first order only" : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={coupon.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {coupon.isActive ? (
                      <Button variant="danger" onClick={() => deactivateCoupon.mutate(coupon.id)} loading={deactivateCoupon.isPending}>
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
