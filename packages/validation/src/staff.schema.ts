import { z } from "zod";
import { Role } from "@shri-anandam/shared-types";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

const roleNameSchema = z.enum(Object.values(Role) as [string, ...string[]]);

/** Staff passwords: same 8-128 length as login, but creation/reset additionally requires mixed character classes. */
export const staffPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a digit");

export const createStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: staffPasswordSchema,
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(20).optional(),
  roles: z.array(roleNameSchema).min(1, "Assign at least one role"),
  branchIds: z.array(uuidSchema).min(1, "Assign at least one branch"),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

export const assignStaffRolesSchema = z.object({
  roles: z.array(roleNameSchema).min(1, "A staff member must hold at least one role"),
});
export type AssignStaffRolesDto = z.infer<typeof assignStaffRolesSchema>;

export const assignStaffBranchesSchema = z.object({
  branchIds: z.array(uuidSchema).min(1, "A staff member must be assigned to at least one branch"),
});
export type AssignStaffBranchesDto = z.infer<typeof assignStaffBranchesSchema>;

export const resetStaffPasswordSchema = z.object({
  newPassword: staffPasswordSchema,
});
export type ResetStaffPasswordDto = z.infer<typeof resetStaffPasswordSchema>;

export const listStaffQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  branchId: uuidSchema.optional(),
  role: roleNameSchema.optional(),
  search: z.string().trim().max(150).optional(),
});
export type ListStaffQueryDto = z.infer<typeof listStaffQuerySchema>;
