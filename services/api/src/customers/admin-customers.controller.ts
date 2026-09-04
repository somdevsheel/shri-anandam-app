import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  listCustomersAdminQuerySchema,
  updateCustomerAdminSchema,
  uuidSchema,
  type ListCustomersAdminQueryDto,
  type UpdateCustomerAdminDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { CustomersService } from "./customers.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentStaff } from "../common/decorators/current-staff.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

/**
 * A separate controller (and `admin/` path prefix — the first in this
 * codebase) rather than adding routes to CustomersController, whose base
 * path (`customers/me`) is a literal exact match — mixing a `:id`
 * parameterized route onto the same controller risks NestJS route
 * ordering ambiguity for zero benefit. Staff-only, permission-gated, and
 * scoped to whichever customer id is asked for (no implicit "me").
 */
@Controller("admin/customers")
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(Permission.CUSTOMER_READ)
  list(@Query(new ZodValidationPipe(listCustomersAdminQuerySchema)) query: ListCustomersAdminQueryDto) {
    return this.customers.listAdmin(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.CUSTOMER_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.customers.getAdminDetail(id);
  }

  @Patch(":id")
  @RequirePermissions(Permission.CUSTOMER_UPDATE)
  update(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateCustomerAdminSchema)) body: UpdateCustomerAdminDto,
    @Req() req: Request,
  ) {
    return this.customers.updateAdmin(id, body, staff, requestContext(req));
  }
}
