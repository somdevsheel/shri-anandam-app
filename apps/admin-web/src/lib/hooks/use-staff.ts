import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignStaffBranchesDto,
  AssignStaffRolesDto,
  CreateStaffDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
} from "@shri-anandam/validation";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import type { PaginatedResult, PermissionRow, Role, Staff } from "@/lib/types";

interface ListStaffParams {
  isActive?: boolean;
  branchId?: string;
  role?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useStaffList(params: ListStaffParams) {
  return useQuery({
    queryKey: queryKeys.staff(params as Record<string, unknown>),
    queryFn: () => apiRequest<PaginatedResult<Staff>>("/staff", { query: { ...params, pageSize: params.pageSize ?? 20 } }),
  });
}

export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.staffMember(id ?? ""),
    queryFn: () => apiRequest<Staff>(`/staff/${id}`),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateStaffDto) => apiRequest<Staff>("/staff", { method: "POST", body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateStaffDto) => apiRequest<Staff>(`/staff/${id}`, { method: "PATCH", body: dto }),
    onSuccess: (staff) => {
      queryClient.setQueryData(queryKeys.staffMember(id), staff);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export function useDeactivateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Staff>(`/staff/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });
}

export function useAssignStaffRoles(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignStaffRolesDto) => apiRequest<Staff>(`/staff/${id}/roles`, { method: "PATCH", body: dto }),
    onSuccess: (staff) => queryClient.setQueryData(queryKeys.staffMember(id), staff),
  });
}

export function useAssignStaffBranches(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AssignStaffBranchesDto) => apiRequest<Staff>(`/staff/${id}/branches`, { method: "PATCH", body: dto }),
    onSuccess: (staff) => queryClient.setQueryData(queryKeys.staffMember(id), staff),
  });
}

export function useResetStaffPassword(id: string) {
  return useMutation({
    mutationFn: (dto: ResetStaffPasswordDto) => apiRequest<{ message: string }>(`/staff/${id}/reset-password`, { method: "POST", body: dto }),
  });
}

// ---------------------------------------------------------------------------
// Roles & Permissions
// ---------------------------------------------------------------------------

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles,
    queryFn: () => apiRequest<Role[]>("/roles"),
  });
}

export function usePermissionsList() {
  return useQuery({
    queryKey: queryKeys.permissions,
    queryFn: () => apiRequest<PermissionRow[]>("/permissions"),
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) =>
      apiRequest<Role>(`/roles/${roleId}/permissions`, { method: "PATCH", body: { permissionKeys } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.roles }),
  });
}
