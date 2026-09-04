"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffList } from "@/lib/hooks/use-staff";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { Pagination } from "@/components/ui/Pagination";

export default function StaffPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useStaffList({ search: search || undefined, page });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Staff</h1>
        <Link href="/staff/new">
          <Button>New Staff Member</Button>
        </Link>
      </div>

      <div className="mb-4 mt-4 w-72">
        <Input
          placeholder="Search by name or email…"
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
            <ErrorBlock message="Couldn't load staff." />
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No staff members found" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Branches</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0 hover:bg-background/50">
                  <td className="px-4 py-3">
                    <Link href={`/staff/${member.id}`} className="font-semibold text-primary hover:underline">
                      {member.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{member.email}</td>
                  <td className="px-4 py-3 text-text-muted">{member.staffRoles.map((sr) => sr.role.name).join(", ")}</td>
                  <td className="px-4 py-3 text-text-muted">{member.branchStaff.map((bs) => bs.branch.code).join(", ")}</td>
                  <td className="px-4 py-3">
                    <Badge status={member.isActive ? "ACTIVE" : "INACTIVE"} />
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
