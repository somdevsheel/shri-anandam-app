import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { updateRolePermissionsSchema, uuidSchema, type UpdateRolePermissionsDto } from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { RolesService } from "./roles.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("roles")
  @RequirePermissions(Permission.STAFF_READ)
  listRoles() {
    return this.roles.listRoles();
  }

  @Get("permissions")
  @RequirePermissions(Permission.STAFF_READ)
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Patch("roles/:id/permissions")
  @RequirePermissions(Permission.ROLE_MANAGE)
  updatePermissions(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateRolePermissionsSchema)) body: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.roles.updateRolePermissions(id, body, user, requestContext(req));
  }
}
