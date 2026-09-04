import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  assignStaffBranchesSchema,
  assignStaffRolesSchema,
  createStaffSchema,
  listStaffQuerySchema,
  resetStaffPasswordSchema,
  updateStaffSchema,
  uuidSchema,
  type AssignStaffBranchesDto,
  type AssignStaffRolesDto,
  type CreateStaffDto,
  type ListStaffQueryDto,
  type ResetStaffPasswordDto,
  type UpdateStaffDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { StaffService } from "./staff.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_READ)
  list(@Query(new ZodValidationPipe(listStaffQuerySchema)) query: ListStaffQueryDto) {
    return this.staff.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.STAFF_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.staff.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.STAFF_CREATE)
  create(
    @Body(new ZodValidationPipe(createStaffSchema)) body: CreateStaffDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.staff.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.STAFF_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateStaffSchema)) body: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.staff.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.STAFF_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.staff.deactivate(id, user, requestContext(req));
  }

  @Patch(":id/roles")
  @RequirePermissions(Permission.STAFF_UPDATE)
  assignRoles(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(assignStaffRolesSchema)) body: AssignStaffRolesDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.staff.assignRoles(id, body, user, requestContext(req));
  }

  @Patch(":id/branches")
  @RequirePermissions(Permission.STAFF_UPDATE)
  assignBranches(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(assignStaffBranchesSchema)) body: AssignStaffBranchesDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.staff.assignBranches(id, body, user, requestContext(req));
  }

  @Post(":id/reset-password")
  @RequirePermissions(Permission.STAFF_UPDATE)
  async resetPassword(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(resetStaffPasswordSchema)) body: ResetStaffPasswordDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    await this.staff.resetPassword(id, body, user, requestContext(req));
    return { message: "Password reset — all existing sessions for this account were revoked" };
  }
}
