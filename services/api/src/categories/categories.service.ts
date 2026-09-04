import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import { ensureUniqueSlug } from "../common/util/unique-slug";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListCategoriesQueryDto) {
    const where: Prisma.CategoryWhereInput = {
      isActive: query.isActive,
      parentId: query.parentId,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.category.findMany({ where, skip, take, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
          this.prisma.category.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: { orderBy: { sortOrder: "asc" } } },
    });
    if (!category) throw new NotFoundError("Category", id);
    return category;
  }

  async create(dto: CreateCategoryDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const slug = await ensureUniqueSlug(
      dto.slug,
      dto.name,
      async (candidate) => (await this.prisma.category.count({ where: { slug: candidate } })) > 0,
    );

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: dto.name,
          slug,
          parentId: dto.parentId,
          imageUrl: dto.imageUrl,
          sortOrder: dto.sortOrder,
        },
      });

      await this.auditLog.record(
        {
          actor,
          action: "CATEGORY_CREATED",
          entityType: "Category",
          entityId: category.id,
          newValue: category,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return category;
    });
  }

  async update(id: string, dto: UpdateCategoryDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({ where: { id }, data: dto });

      await this.auditLog.record(
        {
          actor,
          action: "CATEGORY_UPDATED",
          entityType: "Category",
          entityId: category.id,
          oldValue: { name: existing.name, parentId: existing.parentId, isActive: existing.isActive },
          newValue: { name: category.name, parentId: category.parentId, isActive: category.isActive },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return category;
    });
  }

  /** section 36: soft delete — categories are referenced by products, never hard-deleted. */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({ where: { id }, data: { isActive: false } });

      await this.auditLog.record(
        {
          actor,
          action: "CATEGORY_DEACTIVATED",
          entityType: "Category",
          entityId: category.id,
          oldValue: { isActive: true },
          newValue: { isActive: false },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return category;
    });
  }
}
