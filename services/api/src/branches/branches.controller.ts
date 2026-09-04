import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  createBranchSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
  uuidSchema,
  type CreateBranchDto,
  type ListBranchesQueryDto,
  type UpdateBranchDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { BranchesService } from "./branches.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions(Permission.BRANCH_READ)
  list(@Query(new ZodValidationPipe(listBranchesQuerySchema)) query: ListBranchesQueryDto) {
    return this.branches.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.BRANCH_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.branches.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.BRANCH_CREATE)
  create(
    @Body(new ZodValidationPipe(createBranchSchema)) body: CreateBranchDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.branches.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.BRANCH_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) body: UpdateBranchDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.branches.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.BRANCH_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.branches.deactivate(id, user, requestContext(req));
  }
}
