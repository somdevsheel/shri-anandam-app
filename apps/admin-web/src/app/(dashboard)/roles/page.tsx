"use client";

import { useState } from "react";
import { usePermissionsList, useRoles, useUpdateRolePermissions } from "@/lib/hooks/use-staff";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingBlock, ErrorBlock } from "@/components/ui/Feedback";
import { Permission } from "@shri-anandam/shared-types";

/** Groups permission keys by their dot-prefix ("order.read" -> "order") purely for readable section headers — no meaning beyond display. */
function groupByPrefix(keys: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of keys) {
    const prefix = key.split(".")[0] ?? key;
    (groups[prefix] ??= []).push(key);
  }
  return groups;
}

export default function RolesPage() {
  const { data: roles, isLoading, error } = useRoles();
  const { data: permissions } = usePermissionsList();
  const updatePermissions = useUpdateRolePermissions();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission(Permission.ROLE_MANAGE);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftKeys, setDraftKeys] = useState<Set<string> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock />;
  if (error || !roles) return <ErrorBlock message="Couldn't load roles." />;

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const currentKeys = draftKeys ?? new Set(selectedRole?.rolePermissions?.map((rp) => rp.permission.key) ?? []);
  const permissionGroups = groupByPrefix((permissions ?? []).map((p) => p.key));

  const selectRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setDraftKeys(null);
    setSaveError(null);
  };

  const toggle = (key: string) => {
    if (!canManage) return;
    const next = new Set(currentKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraftKeys(next);
  };

  const handleSave = () => {
    if (!selectedRole) return;
    setSaveError(null);
    updatePermissions.mutate(
      { roleId: selectedRole.id, permissionKeys: Array.from(currentKeys) },
      { onSuccess: () => setDraftKeys(null), onError: (err) => setSaveError(err instanceof ApiError ? err.message : "Could not save permissions.") },
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Roles & Permissions</h1>

      <div className="mt-4 flex gap-2">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => selectRole(role.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              (selectedRole?.id ?? roles[0]?.id) === role.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {role.name}
          </button>
        ))}
      </div>

      {selectedRole ? (
        <Card className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text">{selectedRole.name}</h2>
              {!canManage ? <p className="text-xs text-text-muted">View only — you don&apos;t have role.manage.</p> : null}
            </div>
            {canManage && draftKeys ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDraftKeys(null)}>
                  Discard
                </Button>
                <Button onClick={handleSave} loading={updatePermissions.isPending}>
                  Save
                </Button>
              </div>
            ) : null}
          </div>

          {saveError ? (
            <div className="mb-4">
              <ErrorBlock message={saveError} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(permissionGroups).map(([group, keys]) => (
              <div key={group}>
                <p className="mb-1 text-xs font-bold uppercase text-text-muted">{group}</p>
                <div className="flex flex-col gap-1">
                  {keys.map((key) => (
                    <label key={key} className={`flex items-center gap-2 text-sm ${canManage ? "cursor-pointer" : "cursor-default opacity-80"}`}>
                      <input type="checkbox" className="size-4" checked={currentKeys.has(key)} onChange={() => toggle(key)} disabled={!canManage} />
                      {key}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
