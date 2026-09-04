"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@shri-anandam/shared-types";
import { createStaffSchema } from "@shri-anandam/validation";
import { useCreateStaff } from "@/lib/hooks/use-staff";
import { useBranches } from "@/lib/hooks/use-catalog-support";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ErrorBlock } from "@/components/ui/Feedback";

export default function NewStaffPage() {
  const router = useRouter();
  const { data: branches } = useBranches();
  const createStaff = useCreateStaff();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: string) => setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  const toggleBranch = (id: string) => setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  const handleSubmit = () => {
    const result = createStaffSchema.safeParse({ email, password, name, phone: phone || undefined, roles, branchIds });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form for errors");
      return;
    }
    setError(null);
    createStaff.mutate(result.data, {
      onSuccess: (staff) => router.replace(`/staff/${staff.id}`),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create staff member."),
    });
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-text">New Staff Member</h1>

      <Card className="mt-6 flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Temporary Password" type="password" hint="At least 8 characters, mixed case + a digit" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div>
          <p className="mb-1 text-sm font-semibold text-text">Roles</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(Role).map((role) => (
              <label key={role} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input type="checkbox" className="size-4" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                {role}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-text">Branches</p>
          <div className="flex flex-wrap gap-2">
            {branches?.items.map((branch) => (
              <label key={branch.id} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input type="checkbox" className="size-4" checked={branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                {branch.name}
              </label>
            ))}
          </div>
        </div>

        {error ? <ErrorBlock message={error} /> : null}

        <Button onClick={handleSubmit} loading={createStaff.isPending} disabled={!name || !email || !password || roles.length === 0 || branchIds.length === 0}>
          Create Staff Member
        </Button>
      </Card>
    </div>
  );
}
