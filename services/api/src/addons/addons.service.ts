import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { CreateAddonDto, ListAddonsQueryDto, UpdateAddonDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AddonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListAddonsQueryDto) {
    const where: Prisma.AddonWhereInput = {
      isActive: query.isActive,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.addon.findMany({ where, skip, take, orderBy: { name: "asc" } }),
          this.prisma.addon.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const addon = await this.prisma.addon.findUnique({ where: { id } });
    if (!addon) throw new NotFoundError("Addon", id);
    return addon;
  }

  async create(dto: CreateAddonDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.addon.create({ data: dto });

      await this.auditLog.record(
        {
          actor,
          action: "ADDON_CREATED",
          entityType: "Addon",
          entityId: addon.id,
          newValue: addon,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return addon;
    });
  }

  async update(id: string, dto: UpdateAddonDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.addon.update({ where: { id }, data: dto });

      await this.auditLog.record(
        {
          actor,
          action: "ADDON_UPDATED",
          entityType: "Addon",
          entityId: addon.id,
          oldValue: existing,
          newValue: addon,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return addon;
    });
  }

  /** Addons are referenced by historical OrderItemAddon snapshots — deactivate, never hard-delete. */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const addon = await tx.addon.update({ where: { id }, data: { isActive: false } });

      await this.auditLog.record(
        {
          actor,
          action: "ADDON_DEACTIVATED",
          entityType: "Addon",
          entityId: addon.id,
          oldValue: { isActive: true },
          newValue: { isActive: false },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return addon;
    });
  }
}
