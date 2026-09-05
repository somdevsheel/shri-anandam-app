import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  applyCouponSchema,
  createCouponSchema,
  listCouponsQuerySchema,
  updateCouponSchema,
  uuidSchema,
  type ApplyCouponDto,
  type CreateCouponDto,
  type ListCouponsQueryDto,
  type UpdateCouponDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { CouponsService } from "./coupons.service";
import { CartService } from "../cart/cart.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentCustomer } from "../common/decorators/current-customer.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedCustomer, AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("coupons")
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly cart: CartService,
  ) {}

  // -------------------------------------------------------------------
  // Admin CRUD
  // -------------------------------------------------------------------

  @Get()
  @RequirePermissions(Permission.COUPON_READ)
  list(@Query(new ZodValidationPipe(listCouponsQuerySchema)) query: ListCouponsQueryDto) {
    return this.coupons.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.COUPON_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.coupons.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.COUPON_CREATE)
  create(
    @Body(new ZodValidationPipe(createCouponSchema)) body: CreateCouponDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.coupons.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.COUPON_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) body: UpdateCouponDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.coupons.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.COUPON_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.coupons.deactivate(id, user, requestContext(req));
  }

  // -------------------------------------------------------------------
  // Customer-facing preview — no side effects, just tells checkout what
  // the discount would be. The actual application happens inside
  // OrdersService.createOrder(), which re-validates independently.
  // -------------------------------------------------------------------

  @Post("preview")
  async preview(@CurrentCustomer() customer: AuthenticatedCustomer, @Body(new ZodValidationPipe(applyCouponSchema)) body: ApplyCouponDto) {
    const cartState = await this.cart.getCart(customer.id);
    return this.coupons.resolveForCart(customer.id, body.code, cartState);
  }
}
