import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@shri-anandam/shared-types";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { ForbiddenError } from "../errors/app.error";
import type { AuthenticatedUser } from "../../auth/types/authenticated-user.type";

/**
 * The actual backend RBAC enforcement point (section 34). Runs after
 * JwtAuthGuard has populated request.user. Customer-facing routes never
 * declare @RequirePermissions — only staff/admin routes do; a customer
 * principal hitting a permissioned route is rejected because it carries
 * no `permissions` array.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || user.subjectType !== "STAFF") {
      throw new ForbiddenError();
    }

    const hasAll = required.every((permission) => user.permissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenError(`Missing required permission(s): ${required.join(", ")}`);
    }

    return true;
  }
}
