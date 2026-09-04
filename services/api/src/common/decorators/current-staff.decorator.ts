import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { ForbiddenError } from "../errors/app.error";
import type { AuthenticatedStaff, AuthenticatedUser } from "../../auth/types/authenticated-user.type";

/**
 * Extracts the authenticated principal and asserts it's STAFF — for
 * routes whose actual required permission depends on the request body
 * (e.g. updating an order's status: which permission applies depends on
 * the target status), so a static @RequirePermissions() on the route
 * can't express it. The service does the dynamic permission check using
 * the `permissions` array this returns; this decorator's only job is
 * making sure a CUSTOMER token can't reach the handler at all.
 */
export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedStaff => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  if (request.user.subjectType !== "STAFF") {
    throw new ForbiddenError("This endpoint is for staff accounts only");
  }
  return request.user;
});
