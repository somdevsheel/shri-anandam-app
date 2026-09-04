"use client";

import { useState } from "react";
import { Role } from "@shri-anandam/shared-types";
import { useAssignStaffBranches, useAssignStaffRoles } from "@/lib/hooks/use-staff";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorBlock } from "@/components/ui/Feedback";
import type { Staff } from "@/lib/types";

/** Rendered with `key={staff.id}` by the parent — see ProductDetailsForm's comment for why local state is initialized directly from props rather than synced via a useEffect. */
export function StaffAccessForm({ staff }: { staff: Staff }) {
  const { data: branches } = useBranches();
  const assignRoles = useAssignStaffRoles(staff.id);
  const assignBranches = useAssignStaffBranches(staff.id);

  const [roles, setRoles] = useState<string[]>(staff.staffRoles.map((sr) => sr.role.name));
  const [branchIds, setBranchIds] = useState<string[]>(staff.branchStaff.map((bs) => bs.branchId));
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: string) => setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  const toggleBranch = (id: string) => setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  const saveRoles = () => {
    if (roles.length === 0) return setError("A staff member must hold at least one role");
    setError(null);
    assignRoles.mutate({ roles }, { onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update roles.") });
  };

  const saveBranches = () => {
    if (branchIds.length === 0) return setError("A staff member must be assigned to at least one branch");
    setError(null);
    assignBranches.mutate({ branchIds }, { onError: (err) => setError(err instanceof ApiError ? err.message : "Could not update branches.") });
  };

  return (
    <Card>
      <CardHeader title="Roles & Branches" />
      {error ? (
        <div className="mb-3">
          <ErrorBlock message={error} />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-sm font-semibold text-text">Roles</p>
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(Role).map((role) => (
              <label key={role} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input type="checkbox" className="size-4" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                {role}
              </label>
            ))}
            <Button variant="outline" onClick={saveRoles} loading={assignRoles.isPending}>
              Save Roles
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-text">Branches</p>
          <div className="flex flex-wrap items-center gap-2">
            {branches?.items.map((branch) => (
              <label key={branch.id} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input type="checkbox" className="size-4" checked={branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                {branch.name}
              </label>
            ))}
            <Button variant="outline" onClick={saveBranches} loading={assignBranches.isPending}>
              Save Branches
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
