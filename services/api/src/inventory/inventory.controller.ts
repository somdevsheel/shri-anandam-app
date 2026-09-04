import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  adjustInventorySchema,
  createInventoryItemSchema,
  createProductionBatchSchema,
  listInventoryQuerySchema,
  listInventoryTransactionsQuerySchema,
  listProductionBatchesQuerySchema,
  recordWastageSchema,
  restockInventorySchema,
  uuidSchema,
  type AdjustInventoryDto,
  type CreateInventoryItemDto,
  type CreateProductionBatchDto,
  type ListInventoryQueryDto,
  type ListInventoryTransactionsQueryDto,
  type ListProductionBatchesQueryDto,
  type RecordWastageDto,
  type RestockInventoryDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { InventoryService } from "./inventory.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  list(@Query(new ZodValidationPipe(listInventoryQuerySchema)) query: ListInventoryQueryDto) {
    return this.inventory.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.INVENTORY_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.inventory.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  create(
    @Body(new ZodValidationPipe(createInventoryItemSchema)) body: CreateInventoryItemDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.inventory.create(body, user, requestContext(req));
  }

  @Post(":id/restock")
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  restock(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(restockInventorySchema)) body: RestockInventoryDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.inventory.restock(id, body, user, requestContext(req));
  }

  @Patch(":id/adjust")
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  adjust(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(adjustInventorySchema)) body: AdjustInventoryDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.inventory.adjust(id, body, user, requestContext(req));
  }

  @Post(":id/wastage")
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  recordWastage(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(recordWastageSchema)) body: RecordWastageDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.inventory.recordWastage(id, body, user, requestContext(req));
  }

  @Get(":id/transactions")
  @RequirePermissions(Permission.INVENTORY_READ)
  listTransactions(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Query(new ZodValidationPipe(listInventoryTransactionsQuerySchema)) query: ListInventoryTransactionsQueryDto,
  ) {
    return this.inventory.listTransactions(id, query);
  }

  @Get(":id/reservations")
  @RequirePermissions(Permission.INVENTORY_READ)
  listReservations(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.inventory.listReservations(id);
  }
}

@Controller("production-batches")
export class ProductionBatchesController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_READ)
  list(@Query(new ZodValidationPipe(listProductionBatchesQuerySchema)) query: ListProductionBatchesQueryDto) {
    return this.inventory.listProductionBatches(query);
  }

  @Post()
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  create(
    @Body(new ZodValidationPipe(createProductionBatchSchema)) body: CreateProductionBatchDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.inventory.createProductionBatch(body, user, requestContext(req));
  }
}
