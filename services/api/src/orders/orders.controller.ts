import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  addOrderNoteSchema,
  cancelOrderSchema,
  createOrderSchema,
  idempotencyKeySchema,
  listMyOrdersQuerySchema,
  listOrdersAdminQuerySchema,
  updateOrderStatusSchema,
  uuidSchema,
  type AddOrderNoteDto,
  type CancelOrderDto,
  type CreateOrderDto,
  type UpdateOrderStatusDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { OrdersService } from "./orders.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentCustomer } from "../common/decorators/current-customer.decorator";
import { CurrentStaff } from "../common/decorators/current-staff.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import { ForbiddenError, ValidationError } from "../common/errors/app.error";
import type { AuthenticatedCustomer, AuthenticatedStaff, AuthenticatedUser } from "../auth/types/authenticated-user.type";

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderDto,
    // @Headers() doesn't support the (name, ...pipes) overload @Body/
    // @Param/@Query do — validated manually below instead.
    @Headers("idempotency-key") rawIdempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    const idempotencyKey = rawIdempotencyKey ? parseOrThrow(idempotencyKeySchema, rawIdempotencyKey) : undefined;
    return this.orders.createOrder(customer, body, idempotencyKey, requestContext(req));
  }

  /**
   * No @RequirePermissions() here — behavior branches on the caller's
   * subjectType: a customer always sees only their own orders (no
   * filters beyond status/pagination accepted, even if sent); staff
   * need Permission.ORDER_READ to see the branch/date/customer-
   * filterable admin view. Both scopes, and their distinct query
   * schemas, are resolved here rather than via a static decorator,
   * since which one applies depends on who's asking.
   */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() rawQuery: Record<string, unknown>) {
    if (user.subjectType === "CUSTOMER") {
      return this.orders.listMine(user.id, parseOrThrow(listMyOrdersQuerySchema, rawQuery));
    }

    if (!user.permissions.includes(Permission.ORDER_READ)) {
      throw new ForbiddenError("Missing required permission: order.read");
    }
    return this.orders.listAdmin(parseOrThrow(listOrdersAdminQuerySchema, rawQuery));
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthenticatedUser, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.orders.getById(id, user);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(cancelOrderSchema)) body: CancelOrderDto,
    @Req() req: Request,
  ) {
    return this.orders.cancelOwnOrder(customer, id, body, requestContext(req));
  }

  @Post(":id/reorder")
  reorder(@CurrentCustomer() customer: AuthenticatedCustomer, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.orders.reorder(customer, id);
  }

  /** Staff-only; which permission applies depends on the target status (see OrdersService.updateStatus). */
  @Patch(":id/status")
  updateStatus(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateOrderStatusSchema)) body: UpdateOrderStatusDto,
    @Req() req: Request,
  ) {
    return this.orders.updateStatus(staff, id, body, requestContext(req));
  }

  @Post(":id/notes")
  @RequirePermissions(Permission.ORDER_ACCEPT)
  addNote(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(addOrderNoteSchema)) body: AddOrderNoteDto,
  ) {
    return this.orders.addNote(staff, id, body);
  }
}

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { path: (string | number)[]; message: string }[] } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = (result.error?.issues ?? []).map((issue) => ({ field: issue.path.join("."), message: issue.message }));
    throw new ValidationError("Request validation failed", details);
  }
  return result.data as T;
}
