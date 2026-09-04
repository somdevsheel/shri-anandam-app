import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  addManualPaymentSchema,
  collectPaymentSchema,
  createRefundSchema,
  reconciliationQuerySchema,
  uuidSchema,
  type AddManualPaymentDto,
  type CollectPaymentDto,
  type CreateRefundDto,
  type ReconciliationQueryDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { PaymentsService } from "./payments.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentCustomer } from "../common/decorators/current-customer.decorator";
import { CurrentStaff } from "../common/decorators/current-staff.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedCustomer, AuthenticatedStaff, AuthenticatedUser } from "../auth/types/authenticated-user.type";

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("orders/:orderId/payments")
  listForOrder(@CurrentUser() user: AuthenticatedUser, @Param("orderId", new ZodValidationPipe(uuidSchema)) orderId: string) {
    return this.payments.listForOrder(orderId, user);
  }

  /** Customer-facing: obtain (or retry obtaining) the gateway order id to open checkout against. */
  @Post("payments/:id/initiate")
  initiate(@CurrentCustomer() customer: AuthenticatedCustomer, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.payments.initiatePayment(customer.id, id);
  }

  @Post("payments/:id/collect")
  @RequirePermissions(Permission.PAYMENT_COLLECT)
  collect(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(collectPaymentSchema)) body: CollectPaymentDto,
    @Req() req: Request,
  ) {
    return this.payments.collect(staff, id, body, requestContext(req));
  }

  @Post("orders/:orderId/payments")
  @RequirePermissions(Permission.PAYMENT_COLLECT)
  addManualPayment(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("orderId", new ZodValidationPipe(uuidSchema)) orderId: string,
    @Body(new ZodValidationPipe(addManualPaymentSchema)) body: AddManualPaymentDto,
    @Req() req: Request,
  ) {
    return this.payments.addManualPayment(staff, orderId, body, requestContext(req));
  }

  @Post("payments/:id/refunds")
  @RequirePermissions(Permission.PAYMENT_REFUND)
  createRefund(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(createRefundSchema)) body: CreateRefundDto,
    @Req() req: Request,
  ) {
    return this.payments.createRefund(staff, id, body, requestContext(req));
  }

  @Get("reports/payments/reconciliation")
  @RequirePermissions(Permission.PAYMENT_READ, Permission.REPORT_READ)
  reconciliation(@Query(new ZodValidationPipe(reconciliationQuerySchema)) query: ReconciliationQueryDto) {
    return this.payments.getReconciliation(query);
  }
}
