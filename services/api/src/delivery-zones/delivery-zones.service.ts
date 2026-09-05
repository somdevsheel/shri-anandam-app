import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { CreateDeliveryZoneDto, ListDeliveryZonesQueryDto, UpdateDeliveryZoneDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Admin CRUD for the DeliveryZone rows DeliveryFeeService already reads
 * at checkout (services/api/src/orders/delivery-fee.service.ts) — that
 * service was built and wired in first with nothing to manage it,
 * meaning every DELIVERY order failed with "we don't deliver to this
 * address yet" until a zone actually existed. This is the missing other
 * half, not a new feature.
 */
@Injectable()
export class DeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListDeliveryZonesQueryDto) {
    const where: Prisma.DeliveryZoneWhereInput = { branchId: query.branchId, isActive: query.isActive };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.deliveryZone.findMany({ where, skip, take, orderBy: { name: "asc" } }),
          this.prisma.deliveryZone.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundError("DeliveryZone", id);
    return zone;
  }

  async create(dto: CreateDeliveryZoneDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.create({
        data: {
          branchId: dto.branchId,
          name: dto.name,
          pincodes: dto.pincodes,
          minOrderInPaise: dto.minOrderInPaise,
          deliveryFeeInPaise: dto.deliveryFeeInPaise,
          freeDeliveryThresholdInPaise: dto.freeDeliveryThresholdInPaise,
        },
      });

      await this.auditLog.record(
        { actor, action: "DELIVERY_ZONE_CREATED", entityType: "DeliveryZone", entityId: zone.id, newValue: zone, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return zone;
    });
  }

  async update(id: string, dto: UpdateDeliveryZoneDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.update({ where: { id }, data: dto });

      await this.auditLog.record(
        { actor, action: "DELIVERY_ZONE_UPDATED", entityType: "DeliveryZone", entityId: zone.id, oldValue: existing, newValue: zone, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return zone;
    });
  }

  /** Referenced by nothing that would orphan (no order snapshot points at a zone id) but deactivate-not-delete anyway, matching every other admin resource's convention here. */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.update({ where: { id }, data: { isActive: false } });

      await this.auditLog.record(
        { actor, action: "DELIVERY_ZONE_DEACTIVATED", entityType: "DeliveryZone", entityId: zone.id, oldValue: { isActive: true }, newValue: { isActive: false }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return zone;
    });
  }
}
