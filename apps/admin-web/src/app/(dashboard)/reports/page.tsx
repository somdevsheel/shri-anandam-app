"use client";

import { useState } from "react";
import { useReconciliation } from "@/lib/hooks/use-reports";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/ui/Feedback";
import { formatInr } from "@/lib/format";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [dateFrom, setDateFrom] = useState(isoDate(monthAgo));
  const [dateTo, setDateTo] = useState(isoDate(today));
  const [branchId, setBranchId] = useState("");

  const { data: branches } = useBranches();
  const { data, isLoading, error } = useReconciliation({
    dateFrom: new Date(dateFrom).toISOString(),
    dateTo: new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString(),
    branchId: branchId || undefined,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Reports</h1>
      <p className="mt-1 text-sm text-text-muted">Payment reconciliation — collections by method, refunds, and net totals for a date range.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <div className="w-56">
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <ErrorBlock message="Couldn't load the reconciliation report." />
        ) : !data ? (
          <EmptyState title="Select a date range" />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <p className="text-sm font-semibold text-text-muted">Total Collected</p>
              <p className="mt-1 text-2xl font-bold text-success">{formatInr(data.totalCollectedInPaise)}</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold text-text-muted">Total Refunded</p>
              <p className="mt-1 text-2xl font-bold text-danger">{formatInr(data.totalRefundsInPaise)}</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold text-text-muted">Net Collected</p>
              <p className="mt-1 text-2xl font-bold text-text">{formatInr(data.netCollectedInPaise)}</p>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader title="Collections by Method" />
              {Object.keys(data.collectionsByMethod).length === 0 ? (
                <p className="text-sm text-text-muted">No payments collected in this range.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <tbody>
                    {Object.entries(data.collectionsByMethod).map(([method, amount]) => (
                      <tr key={method} className="border-b border-border last:border-0">
                        <td className="py-2 text-text">{method}</td>
                        <td className="py-2 text-right font-semibold text-text">{formatInr(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
