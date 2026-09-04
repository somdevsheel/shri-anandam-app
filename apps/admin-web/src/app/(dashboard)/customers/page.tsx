"use client";

import { useState } from "react";
import Link from "next/link";
import { useCustomers } from "@/lib/hooks/use-customers";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";
import { formatDate } from "@/lib/format";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCustomers({ search: search || undefined, page });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Customers</h1>

      <div className="mb-4 mt-4 w-72">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {isLoading ? (
          <LoadingBlock />
        ) : error ? (
          <div className="p-4">
            <ErrorBlock message="Couldn't load customers." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-background/50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-semibold text-primary hover:underline">
                      {customer.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{customer.mobileNumber}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDate(customer.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data ? (
          <div className="px-4 py-3">
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
