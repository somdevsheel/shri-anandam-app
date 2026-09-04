import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  createAddonSchema,
  listAddonsQuerySchema,
  updateAddonSchema,
  uuidSchema,
  type CreateAddonDto,
  type ListAddonsQueryDto,
  type UpdateAddonDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { AddonsService } from "./addons.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("addons")
export class AddonsController {
  constructor(private readonly addons: AddonsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(@Query(new ZodValidationPipe(listAddonsQuerySchema)) query: ListAddonsQueryDto) {
    return this.addons.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.PRODUCT_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.addons.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCT_CREATE)
  create(
    @Body(new ZodValidationPipe(createAddonSchema)) body: CreateAddonDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.addons.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateAddonSchema)) body: UpdateAddonDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.addons.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.PRODUCT_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.addons.deactivate(id, user, requestContext(req));
  }
}
