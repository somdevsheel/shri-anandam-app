import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { InventoryReservationService } from "./inventory-reservation.service";
import { ConflictError, NotFoundError, ValidationError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type {
  AdjustInventoryDto,
  CreateInventoryItemDto,
  CreateProductionBatchDto,
  ListInventoryQueryDto,
  ListInventoryTransactionsQueryDto,
  ListProductionBatchesQueryDto,
  RecordWastageDto,
  RestockInventoryDto,
} from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const INVENTORY_ITEM_INCLUDE = {
  branch: true,
  productVariant: { include: { product: true } },
} satisfies Prisma.InventoryItemInclude;

/**
 * Admin inventory management: creating/viewing items, restocking,
 * manual adjustments, and wastage. The reservation/consumption engine
 * that keeps this transaction-safe under concurrent orders lives in
 * InventoryReservationService — this class only ever touches
 * `stockQuantity` through single atomic Prisma `{increment}`/
 * `{decrement}` operations, never a JS read-modify-write, so it's safe
 * without needing its own row locks.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly reservations: InventoryReservationService,
  ) {}

  async list(query: ListInventoryQueryDto) {
    const where: Prisma.InventoryItemWhereInput = {
      branchId: query.branchId,
      productVariantId: query.productVariantId,
    };

    if (query.outOfStockOnly) {
      where.stockQuantity = { lte: 0 };
    } else if (query.lowStockOnly) {
      // Prisma can't compare two columns of the same row in a `where`
      // filter, so the low-stock predicate is applied in SQL directly.
      // IDs are plain `text` columns, not Postgres's native `uuid` type
      // (Prisma's default for `String @id @default(uuid())`) — no
      // `::uuid` cast, or this fails with "operator does not exist".
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM inventory_items
        WHERE "stockQuantity" <= "lowStockThreshold"
        ${query.branchId ? Prisma.sql`AND "branchId" = ${query.branchId}` : Prisma.empty}
        ${query.productVariantId ? Prisma.sql`AND "productVariantId" = ${query.productVariantId}` : Prisma.empty}
      `;
      where.id = { in: rows.map((r) => r.id) };
    }

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.inventoryItem.findMany({
            where,
            skip,
            take,
            orderBy: { updatedAt: "desc" },
            include: INVENTORY_ITEM_INCLUDE,
          }),
          this.prisma.inventoryItem.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id }, include: INVENTORY_ITEM_INCLUDE });
    if (!item) throw new NotFoundError("InventoryItem", id);

    const activeReserved = await this.prisma.stockReservation.aggregate({
      where: { inventoryItemId: id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    });
    const reserved = activeReserved._sum.quantity ?? new Prisma.Decimal(0);

    return {
      ...item,
      reservedQuantity: reserved,
      availableQuantity: item.stockQuantity.minus(reserved),
      isLowStock: item.stockQuantity.lessThanOrEqualTo(item.lowStockThreshold),
      isOutOfStock: item.stockQuantity.lessThanOrEqualTo(0),
    };
  }

  async create(dto: CreateInventoryItemDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const [branch, variant] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
      this.prisma.productVariant.findUnique({ where: { id: dto.productVariantId } }),
    ]);
    if (!branch) throw new ValidationError("Branch does not exist", [{ field: "branchId", message: "Unknown branch" }]);
    if (!variant) {
      throw new ValidationError("Product variant does not exist", [
        { field: "productVariantId", message: "Unknown variant" },
      ]);
    }

    const existing = await this.prisma.inventoryItem.findUnique({
      where: { branchId_productVariantId: { branchId: dto.branchId, productVariantId: dto.productVariantId } },
    });
    if (existing) {
      throw new ConflictError("An inventory item already exists for this branch and variant");
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          branchId: dto.branchId,
          productVariantId: dto.productVariantId,
          unit: dto.unit,
          stockQuantity: dto.initialQuantity,
          lowStockThreshold: dto.lowStockThreshold,
        },
        include: INVENTORY_ITEM_INCLUDE,
      });

      if (dto.initialQuantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            type: "RESTOCK",
            quantityDelta: dto.initialQuantity,
            staffId: actor.id,
            note: "Initial stock on item creation",
          },
        });
      }

      await this.auditLog.record(
        {
          actor,
          action: "INVENTORY_ITEM_CREATED",
          entityType: "InventoryItem",
          entityId: item.id,
          newValue: { branchId: item.branchId, productVariantId: item.productVariantId, initialQuantity: dto.initialQuantity },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return item;
    });
  }

  async restock(id: string, dto: RestockInventoryDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { stockQuantity: { increment: dto.quantity } },
        include: INVENTORY_ITEM_INCLUDE,
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: "RESTOCK",
          quantityDelta: dto.quantity,
          staffId: actor.id,
          note: dto.note,
        },
      });

      if (dto.batchCode) {
        await tx.productionBatch.create({
          data: {
            productVariantId: item.productVariantId,
            branchId: item.branchId,
            batchCode: dto.batchCode,
            quantityProduced: dto.quantity,
            producedByStaffId: actor.id,
            expiresAt: dto.expiresAt,
          },
        });
      }

      await this.auditLog.record(
        {
          actor,
          action: "INVENTORY_RESTOCKED",
          entityType: "InventoryItem",
          entityId: id,
          newValue: { quantityAdded: dto.quantity, batchCode: dto.batchCode },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return item;
    });
  }

  /** section 45: "Inventory adjustment" is explicitly a sensitive audited action. */
  async adjust(id: string, dto: AdjustInventoryDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    const newQuantity = existing.stockQuantity.plus(dto.quantityDelta);
    if (newQuantity.lessThan(0)) {
      throw new ValidationError("Adjustment would result in negative stock", [
        { field: "quantityDelta", message: `Current stock is ${existing.stockQuantity.toString()}` },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { stockQuantity: { increment: dto.quantityDelta } },
        include: INVENTORY_ITEM_INCLUDE,
      });

      await tx.stockAdjustment.create({
        data: { inventoryItemId: id, staffId: actor.id, quantityDelta: dto.quantityDelta, reason: dto.reason },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: "ADJUSTMENT",
          quantityDelta: dto.quantityDelta,
          staffId: actor.id,
          note: dto.reason,
        },
      });

      await this.auditLog.record(
        {
          actor,
          action: "INVENTORY_ADJUSTED",
          entityType: "InventoryItem",
          entityId: id,
          oldValue: { stockQuantity: existing.stockQuantity.toString() },
          newValue: { stockQuantity: item.stockQuantity.toString(), delta: dto.quantityDelta, reason: dto.reason },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      await this.reservations.maybeFlagLowStock(tx, id, item.stockQuantity);

      return item;
    });
  }

  async recordWastage(id: string, dto: RecordWastageDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (existing.stockQuantity.lessThan(dto.quantity)) {
      throw new ValidationError("Wastage quantity exceeds current stock", [
        { field: "quantity", message: `Current stock is ${existing.stockQuantity.toString()}` },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id },
        data: { stockQuantity: { decrement: dto.quantity } },
        include: INVENTORY_ITEM_INCLUDE,
      });

      await tx.wastage.create({
        data: { inventoryItemId: id, staffId: actor.id, quantity: dto.quantity, reason: dto.reason },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: "WASTAGE",
          quantityDelta: new Prisma.Decimal(dto.quantity).negated(),
          staffId: actor.id,
          note: dto.reason,
        },
      });

      await this.auditLog.record(
        {
          actor,
          action: "INVENTORY_WASTAGE_RECORDED",
          entityType: "InventoryItem",
          entityId: id,
          newValue: { quantity: dto.quantity, reason: dto.reason },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      await this.reservations.maybeFlagLowStock(tx, id, item.stockQuantity);

      return item;
    });
  }

  async listTransactions(id: string, query: ListInventoryTransactionsQueryDto) {
    await this.getById(id);
    const where: Prisma.InventoryTransactionWhereInput = { inventoryItemId: id };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.inventoryTransaction.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          this.prisma.inventoryTransaction.count({ where }),
        ]),
    );
  }

  async listReservations(id: string) {
    await this.getById(id);
    return this.prisma.stockReservation.findMany({
      where: { inventoryItemId: id, status: "ACTIVE" },
      orderBy: { expiresAt: "asc" },
    });
  }

  // ---------------------------------------------------------------------
  // Production batches
  // ---------------------------------------------------------------------

  async createProductionBatch(dto: CreateProductionBatchDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { branchId_productVariantId: { branchId: dto.branchId, productVariantId: dto.productVariantId } },
    });
    if (!item) {
      throw new ValidationError("No inventory item exists for this branch/variant yet — create one first", [
        { field: "productVariantId", message: "Unknown inventory item" },
      ]);
    }

    return this.restock(
      item.id,
      { quantity: dto.quantityProduced, batchCode: dto.batchCode, expiresAt: dto.expiresAt },
      actor,
      ctx,
    );
  }

  async listProductionBatches(query: ListProductionBatchesQueryDto) {
    const where: Prisma.ProductionBatchWhereInput = {
      branchId: query.branchId,
      productVariantId: query.productVariantId,
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.productionBatch.findMany({
            where,
            skip,
            take,
            orderBy: { producedAt: "desc" },
            include: { productVariant: { include: { product: true } }, branch: true },
          }),
          this.prisma.productionBatch.count({ where }),
        ]),
    );
  }
}
