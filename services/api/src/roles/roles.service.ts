import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { AppError, NotFoundError, ValidationError } from "../common/errors/app.error";
import { ErrorCode, Permission, Role as RoleName } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { UpdateRolePermissionsDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    actor: AuthenticatedStaff,
    ctx: RequestContext,
  ) {
    const existing = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!existing) throw new NotFoundError("Role", roleId);

    // The OWNER role must always retain ROLE_MANAGE — otherwise no one
    // could ever fix a misconfigured permission set through the API
    // again (a genuine, unrecoverable-without-direct-DB-access lockout).
    if (existing.name === RoleName.OWNER && !dto.permissionKeys.includes(Permission.ROLE_MANAGE)) {
      throw new AppError(
        ErrorCode.CONFLICT,
        "The OWNER role must always retain the role.manage permission",
        HttpStatus.CONFLICT,
      );
    }

    const permissions = await this.prisma.permission.findMany({ where: { key: { in: dto.permissionKeys } } });
    const resolvedKeys = new Set(permissions.map((p) => p.key));
    const missing = dto.permissionKeys.filter((key) => !resolvedKeys.has(key));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more permissions do not exist",
        missing.map((key) => ({ field: "permissionKeys", message: `Unknown permission: ${key}` })),
      );
    }

    const oldKeys = existing.rolePermissions.map((rp) => rp.permission.key);

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
      });

      await this.auditLog.record(
        {
          actor,
          action: "ROLE_PERMISSIONS_UPDATED",
          entityType: "Role",
          entityId: roleId,
          oldValue: { role: existing.name, permissionKeys: oldKeys },
          newValue: { role: existing.name, permissionKeys: dto.permissionKeys },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }
}
