import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError } from "../common/errors/app.error";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { UpdateOrganizationDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * The business is single-organization (section 29 describes multi-BRANCH,
 * not multi-tenant), so this service exposes "the current organization"
 * rather than a full CRUD/list surface — there is exactly one row, seeded
 * in Phase 1 (prisma/seed.ts), and every branch hangs off it.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getCurrent() {
    const organization = await this.prisma.organization.findFirst({
      include: { branches: { orderBy: { name: "asc" } } },
    });
    if (!organization) {
      throw new NotFoundError("Organization");
    }
    return organization;
  }

  async updateCurrent(dto: UpdateOrganizationDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getCurrent();

    const updated = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({ where: { id: existing.id }, data: { name: dto.name } });
      await this.auditLog.record(
        {
          actor,
          action: "ORGANIZATION_UPDATED",
          entityType: "Organization",
          entityId: org.id,
          oldValue: { name: existing.name },
          newValue: { name: org.name },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );
      return org;
    });

    return updated;
  }
}
