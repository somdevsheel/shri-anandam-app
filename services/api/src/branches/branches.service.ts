import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError, ConflictError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { CreateBranchDto, ListBranchesQueryDto, UpdateBranchDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListBranchesQueryDto) {
    const where: Prisma.BranchWhereInput = {
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { code: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.branch.findMany({ where, skip, take, orderBy: { name: "asc" } }),
          this.prisma.branch.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundError("Branch", id);
    return branch;
  }

  async create(dto: CreateBranchDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const codeTaken = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (codeTaken) {
      throw new ConflictError(`Branch code "${dto.code}" is already in use`);
    }

    const organization = await this.prisma.organization.findFirstOrThrow();

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });

      await this.auditLog.record(
        {
          actor,
          action: "BRANCH_CREATED",
          entityType: "Branch",
          entityId: branch.id,
          newValue: branch,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return branch;
    });
  }

  async update(id: string, dto: UpdateBranchDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({ where: { id }, data: dto });

      await this.auditLog.record(
        {
          actor,
          action: "BRANCH_UPDATED",
          entityType: "Branch",
          entityId: branch.id,
          oldValue: existing,
          newValue: branch,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return branch;
    });
  }

  /**
   * Branches are referenced by orders/inventory/staff assignments —
   * hard-deleting one would orphan historical data (section 36: soft
   * delete where appropriate). "Delete" here means deactivate.
   */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    if (!existing.isActive) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.update({ where: { id }, data: { isActive: false } });

      await this.auditLog.record(
        {
          actor,
          action: "BRANCH_DEACTIVATED",
          entityType: "Branch",
          entityId: branch.id,
          oldValue: { isActive: true },
          newValue: { isActive: false },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return branch;
    });
  }
}
