import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { Permission } from "@shri-anandam/shared-types";
import { PermissionsGuard } from "./permissions.guard";
import { ForbiddenError } from "../errors/app.error";

describe("PermissionsGuard", () => {
  it("allows the request through when the route declares no required permissions", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({}) }), getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("rejects a CUSTOMER principal on a permissioned staff route", () => {
    const reflector = { getAllAndOverride: () => [Permission.ORDER_ACCEPT] } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { subjectType: "CUSTOMER", id: "c1" } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenError);
  });

  it("rejects staff missing the required permission", () => {
    const reflector = { getAllAndOverride: () => [Permission.ORDER_REFUND] } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { subjectType: "STAFF", id: "s1", permissions: [Permission.ORDER_READ] } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenError);
  });

  it("allows staff holding the required permission", () => {
    const reflector = { getAllAndOverride: () => [Permission.ORDER_REFUND] } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { subjectType: "STAFF", id: "s1", permissions: [Permission.ORDER_REFUND, Permission.ORDER_READ] },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
