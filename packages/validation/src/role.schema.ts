import { z } from "zod";
import { Permission } from "@shri-anandam/shared-types";

const permissionKeySchema = z.enum(Object.values(Permission) as [string, ...string[]]);

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(permissionKeySchema),
});
export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
