import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  createDeliveryZoneSchema,
  listDeliveryZonesQuerySchema,
  updateDeliveryZoneSchema,
  uuidSchema,
  type CreateDeliveryZoneDto,
  type ListDeliveryZonesQueryDto,
  type UpdateDeliveryZoneDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { DeliveryZonesService } from "./delivery-zones.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

/**
 * Reuses BRANCH_READ/BRANCH_UPDATE rather than its own permission set —
 * a delivery zone is branch configuration, the same trust level as
 * editing the branch's own address/phone, not a separately risky
 * capability the way coupons (revenue-affecting) got a dedicated one.
 */
@Controller("delivery-zones")
export class DeliveryZonesController {
  constructor(private readonly zones: DeliveryZonesService) {}

  @Get()
  @RequirePermissions(Permission.BRANCH_READ)
  list(@Query(new ZodValidationPipe(listDeliveryZonesQuerySchema)) query: ListDeliveryZonesQueryDto) {
    return this.zones.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.BRANCH_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.zones.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.BRANCH_UPDATE)
  create(
    @Body(new ZodValidationPipe(createDeliveryZoneSchema)) body: CreateDeliveryZoneDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.zones.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.BRANCH_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateDeliveryZoneSchema)) body: UpdateDeliveryZoneDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.zones.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.BRANCH_UPDATE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.zones.deactivate(id, user, requestContext(req));
  }
}
