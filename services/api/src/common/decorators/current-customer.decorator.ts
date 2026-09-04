import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { ForbiddenError } from "../errors/app.error";
import type { AuthenticatedCustomer, AuthenticatedUser } from "../../auth/types/authenticated-user.type";

/**
 * Extracts the authenticated principal and asserts it's a CUSTOMER, not
 * staff — every customer-facing route (profile, addresses, cart) derives
 * "whose data is this" from the token, never from a client-supplied id
 * in the request body/params. A staff token hitting one of these routes
 * is rejected here rather than silently doing nothing useful with a
 * customer-shaped id it doesn't have.
 */
export const CurrentCustomer = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  if (request.user.subjectType !== "CUSTOMER") {
    throw new ForbiddenError("This endpoint is for customer accounts only");
  }
  return request.user;
});
