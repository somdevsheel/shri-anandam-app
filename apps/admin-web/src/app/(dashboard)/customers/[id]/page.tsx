"use client";

import { use } from "react";
import { useCustomer, useUpdateCustomer } from "@/lib/hooks/use-customers";
import { useAuthStore } from "@/lib/auth-store";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingBlock, EmptyState } from "@/components/ui/Feedback";
import { formatDate, formatInr } from "@/lib/format";
import { Permission } from "@shri-anandam/shared-types";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading, error } = useCustomer(id);
  const updateCustomer = useUpdateCustomer(id);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  if (isLoading) return <LoadingBlock />;
  if (error || !customer) return <EmptyState title="Couldn't load this customer" />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{customer.name ?? "Customer"}</h1>
          <p className="mt-1 text-sm text-text-muted">{customer.mobileNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
          {hasPermission(Permission.CUSTOMER_UPDATE) ? (
            <Button
              variant={customer.isActive ? "danger" : "primary"}
              loading={updateCustomer.isPending}
              onClick={() => updateCustomer.mutate({ isActive: !customer.isActive })}
            >
              {customer.isActive ? "Deactivate" : "Activate"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-semibold text-text-muted">Lifetime Orders</p>
          <p className="mt-1 text-2xl font-bold text-text">{customer.orderCount}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-text-muted">Lifetime Spend</p>
          <p className="mt-1 text-2xl font-bold text-text">{formatInr(customer.totalSpentInPaise)}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Profile" />
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-text-muted">Email</dt>
          <dd className="text-text">{customer.email ?? "—"}</dd>
          <dt className="text-text-muted">Joined</dt>
          <dd className="text-text">{formatDate(customer.createdAt)}</dd>
        </dl>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Saved Addresses" />
        {customer.addresses.length === 0 ? (
          <p className="text-sm text-text-muted">No saved addresses.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {customer.addresses.map((address) => (
              <div key={address.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="font-semibold text-text">
                  {address.contactName} {address.isDefault ? <span className="text-xs font-normal text-primary">(default)</span> : null}
                </p>
                <p className="text-text-muted">{address.contactPhone}</p>
                <p className="text-text-muted">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.pincode}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
