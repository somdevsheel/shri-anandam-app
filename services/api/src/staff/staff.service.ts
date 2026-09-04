import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { PasswordService } from "../auth/password.service";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../common/errors/app.error";
import { ErrorCode } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";
import { Role as RoleName } from "@shri-anandam/shared-types";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type {
  AssignStaffBranchesDto,
  AssignStaffRolesDto,
  CreateStaffDto,
  ListStaffQueryDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
} from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Explicit `select` (not `include`) so passwordHash and mfaSecret are
 * structurally impossible to return — neither must ever leave the
 * server, even in an admin-only response: exposing either lets an
 * attacker who compromises a staff/admin session (or intercepts a
 * response) run offline cracking / bypass MFA. Prisma 5.x's `omit` API
 * would express this more tersely but is preview-only until 6.2 — an
 * explicit `select` is the stable equivalent and every field it excludes
 * is a deliberate line here, not an easy-to-miss default.
 */
const STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  isActive: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  staffRoles: { include: { role: true } },
  branchStaff: { include: { branch: true } },
} satisfies Prisma.StaffSelect;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly password: PasswordService,
  ) {}

  async list(query: ListStaffQueryDto) {
    const where: Prisma.StaffWhereInput = {
      isActive: query.isActive,
      branchStaff: query.branchId ? { some: { branchId: query.branchId } } : undefined,
      staffRoles: query.role ? { some: { role: { name: query.role as RoleName } } } : undefined,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.staff.findMany({
            where,
            skip,
            take,
            orderBy: { name: "asc" },
            select: STAFF_SELECT,
          }),
          this.prisma.staff.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: STAFF_SELECT,
    });
    if (!staff) throw new NotFoundError("Staff", id);
    return staff;
  }

  async create(dto: CreateStaffDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const emailTaken = await this.prisma.staff.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (emailTaken) {
      throw new ConflictError(`A staff account already uses email "${dto.email}"`);
    }

    const [roles, branches] = await Promise.all([
      this.prisma.role.findMany({ where: { name: { in: dto.roles as RoleName[] } } }),
      this.prisma.branch.findMany({ where: { id: { in: dto.branchIds } } }),
    ]);
    this.assertRolesResolved(dto.roles, roles);
    this.assertBranchesResolved(dto.branchIds, branches);

    const passwordHash = await this.password.hash(dto.password);

    const staff = await this.prisma.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          phone: dto.phone,
          staffRoles: { create: roles.map((role) => ({ roleId: role.id })) },
          branchStaff: { create: branches.map((branch) => ({ branchId: branch.id })) },
        },
        select: STAFF_SELECT,
      });

      await this.auditLog.record(
        {
          actor,
          action: "STAFF_CREATED",
          entityType: "Staff",
          entityId: created.id,
          // Never include passwordHash/plaintext password in the audit trail.
          newValue: { email: created.email, name: created.name, roles: dto.roles, branchIds: dto.branchIds },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return created;
    });

    return staff;
  }

  async update(id: string, dto: UpdateStaffDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    if (dto.isActive === false) {
      this.assertNotActingOnSelf(id, actor, "deactivate your own account");
      await this.assertNotLastActiveOwner(id, "deactivate");
    }

    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.update({
        where: { id },
        data: dto,
        select: STAFF_SELECT,
      });

      await this.auditLog.record(
        {
          actor,
          action: "STAFF_UPDATED",
          entityType: "Staff",
          entityId: staff.id,
          oldValue: { name: existing.name, phone: existing.phone, isActive: existing.isActive },
          newValue: { name: staff.name, phone: staff.phone, isActive: staff.isActive },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return staff;
    });
  }

  /** section 34/79: staff.delete never hard-deletes — it deactivates (preserves FK history: orders, price changes, order notes, audit trail all reference staffId). */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    return this.update(id, { isActive: false }, actor, ctx);
  }

  async assignRoles(id: string, dto: AssignStaffRolesDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    const isRemovingOwnerRole =
      existing.staffRoles.some((sr) => sr.role.name === RoleName.OWNER) &&
      !dto.roles.includes(RoleName.OWNER);

    // Safety net only — an OWNER stepping down while other OWNERs remain
    // is a legitimate action. What's blocked is leaving the organization
    // with zero active OWNERs, whoever is making the change.
    if (isRemovingOwnerRole) {
      await this.assertNotLastActiveOwner(id, "remove the OWNER role from");
    }

    const roles = await this.prisma.role.findMany({ where: { name: { in: dto.roles as RoleName[] } } });
    this.assertRolesResolved(dto.roles, roles);

    const oldRoleNames = existing.staffRoles.map((sr) => sr.role.name);

    return this.prisma.$transaction(async (tx) => {
      await tx.staffRole.deleteMany({ where: { staffId: id } });
      await tx.staffRole.createMany({ data: roles.map((role) => ({ staffId: id, roleId: role.id })) });

      await this.auditLog.record(
        {
          actor,
          action: "STAFF_ROLES_UPDATED",
          entityType: "Staff",
          entityId: id,
          oldValue: { roles: oldRoleNames },
          newValue: { roles: dto.roles },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.staff.findUniqueOrThrow({ where: { id }, select: STAFF_SELECT });
    });
  }

  async assignBranches(id: string, dto: AssignStaffBranchesDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    const branches = await this.prisma.branch.findMany({ where: { id: { in: dto.branchIds } } });
    this.assertBranchesResolved(dto.branchIds, branches);

    const oldBranchIds = existing.branchStaff.map((bs) => bs.branchId);

    return this.prisma.$transaction(async (tx) => {
      await tx.branchStaff.deleteMany({ where: { staffId: id } });
      await tx.branchStaff.createMany({ data: branches.map((branch) => ({ staffId: id, branchId: branch.id })) });

      await this.auditLog.record(
        {
          actor,
          action: "STAFF_BRANCHES_UPDATED",
          entityType: "Staff",
          entityId: id,
          oldValue: { branchIds: oldBranchIds },
          newValue: { branchIds: dto.branchIds },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.staff.findUniqueOrThrow({ where: { id }, select: STAFF_SELECT });
    });
  }

  async resetPassword(id: string, dto: ResetStaffPasswordDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    await this.getById(id);
    const passwordHash = await this.password.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id }, data: { passwordHash } });
      // Force re-authentication everywhere: an admin-triggered password
      // reset should invalidate every existing session for that account.
      await tx.session.updateMany({ where: { staffId: id, revokedAt: null }, data: { revokedAt: new Date() } });

      await this.auditLog.record(
        {
          actor,
          action: "STAFF_PASSWORD_RESET",
          entityType: "Staff",
          entityId: id,
          // Deliberately no oldValue/newValue — never write password material to the audit log.
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );
    });
  }

  private assertRolesResolved(requested: string[], resolved: { name: RoleName }[]): void {
    const resolvedNames = new Set(resolved.map((r) => r.name));
    const missing = requested.filter((r) => !resolvedNames.has(r as RoleName));
    if (missing.length > 0) {
      throw new ValidationError("One or more roles do not exist", missing.map((role) => ({ field: "roles", message: `Unknown role: ${role}` })));
    }
  }

  private assertBranchesResolved(requested: string[], resolved: { id: string }[]): void {
    const resolvedIds = new Set(resolved.map((b) => b.id));
    const missing = requested.filter((id) => !resolvedIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more branches do not exist",
        missing.map((id) => ({ field: "branchIds", message: `Unknown branch: ${id}` })),
      );
    }
  }

  private assertNotActingOnSelf(targetId: string, actor: AuthenticatedStaff, actionDescription: string): void {
    if (actor.id === targetId) {
      throw new ForbiddenError(`You cannot ${actionDescription}`);
    }
  }

  /** Refuses an operation that would leave the organization with zero active OWNER accounts. */
  private async assertNotLastActiveOwner(staffId: string, actionDescription: string): Promise<void> {
    const activeOwnerCount = await this.prisma.staff.count({
      where: {
        isActive: true,
        id: { not: staffId },
        staffRoles: { some: { role: { name: RoleName.OWNER } } },
      },
    });
    if (activeOwnerCount === 0) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Cannot ${actionDescription} the only active OWNER — assign OWNER to another staff member first`,
        HttpStatus.CONFLICT,
      );
    }
  }
}
