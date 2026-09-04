"use client";

import { use, useState } from "react";
import { resetStaffPasswordSchema } from "@shri-anandam/validation";
import { useDeactivateStaff, useResetStaffPassword, useStaffMember } from "@/lib/hooks/use-staff";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoadingBlock, EmptyState, ErrorBlock } from "@/components/ui/Feedback";
import { StaffAccessForm } from "@/components/staff/StaffAccessForm";
import { formatDateTime } from "@/lib/format";

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: staff, isLoading, error } = useStaffMember(id);
  const deactivateStaff = useDeactivateStaff();
  const resetPassword = useResetStaffPassword(id);
  const currentStaff = useAuthStore((s) => s.staff);

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (isLoading) return <LoadingBlock />;
  if (error || !staff) return <EmptyState title="Couldn't load this staff member" />;

  const isSelf = staff.id === currentStaff?.id;

  const handleResetPassword = () => {
    const result = resetStaffPasswordSchema.safeParse({ newPassword });
    if (!result.success) {
      setPasswordError(result.error.issues[0]?.message ?? "Check the password requirements");
      return;
    }
    setPasswordError(null);
    setPasswordSuccess(false);
    resetPassword.mutate(result.data, {
      onSuccess: () => {
        setNewPassword("");
        setPasswordSuccess(true);
      },
      onError: (err) => setPasswordError(err instanceof ApiError ? err.message : "Could not reset password."),
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">{staff.name}</h1>
          <p className="mt-1 text-sm text-text-muted">{staff.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge status={staff.isActive ? "ACTIVE" : "INACTIVE"} />
          {staff.isActive && !isSelf ? (
            <Button variant="danger" onClick={() => deactivateStaff.mutate(staff.id)} loading={deactivateStaff.isPending}>
              Deactivate
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <Card>
          <CardHeader title="Details" />
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-text-muted">Phone</dt>
            <dd className="text-text">{staff.phone ?? "—"}</dd>
            <dt className="text-text-muted">Last login</dt>
            <dd className="text-text">{staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : "Never"}</dd>
            <dt className="text-text-muted">Member since</dt>
            <dd className="text-text">{formatDateTime(staff.createdAt)}</dd>
          </dl>
        </Card>

        <StaffAccessForm key={staff.id} staff={staff} />

        <Card>
          <CardHeader title="Reset Password" />
          <p className="mb-3 text-sm text-text-muted">Resetting a password logs the staff member out of every existing session.</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input type="password" placeholder="New temporary password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button onClick={handleResetPassword} loading={resetPassword.isPending} disabled={!newPassword}>
              Reset
            </Button>
          </div>
          {passwordError ? (
            <div className="mt-2">
              <ErrorBlock message={passwordError} />
            </div>
          ) : null}
          {passwordSuccess ? <p className="mt-2 text-sm font-semibold text-success">Password reset — all sessions revoked.</p> : null}
        </Card>
      </div>
    </div>
  );
}
