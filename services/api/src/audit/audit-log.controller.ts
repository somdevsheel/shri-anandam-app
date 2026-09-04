import { Controller, Get, Query } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { listAuditLogsQuerySchema, type ListAuditLogsQueryDto } from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { PrismaService } from "../database/prisma.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { paginate } from "../common/util/paginate";

@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  async list(@Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      createdAt:
        query.from || query.to
          ? { gte: query.from, lte: query.to }
          : undefined,
    };

    return paginate({ page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder }, ({ skip, take }) =>
      this.prisma.$transaction([
        this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        this.prisma.auditLog.count({ where }),
      ]),
    );
  }
}
