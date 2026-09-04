import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@shri-anandam/shared-types";

export const PERMISSIONS_KEY = "permissions";

/**
 * Declares the permission(s) required to call a route. Enforced by
 * PermissionsGuard server-side — this is the actual security boundary.
 * Any UI that hides a button based on the same permission list is a
 * convenience only, never a substitute for this check (section 34).
 */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
