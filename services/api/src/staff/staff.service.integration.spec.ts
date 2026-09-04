import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Role as RoleName } from "@shri-anandam/shared-types";
import type { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { PasswordService } from "../auth/password.service";
import { StaffService } from "./staff.service";
import { AppError } from "../common/errors/app.error";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

/**
 * Real integration test against PostgreSQL (no mocks) — the
 * "last active OWNER" safety net is the kind of rule that's easy to get
 * subtly wrong (off-by-one on self vs. others, active vs. inactive) and
 * expensive to get wrong in production (a locked-out organization).
 * Requires DATABASE_URL to point at a reachable Postgres — see
 * docker-compose.yml / .github/workflows/ci.yml. Tests run in file order
 * (Jest's default) and each one explicitly states the OWNER-count
 * precondition it depends on, since the guard under test is intentionally
 * organization-wide, not scoped to this fixture (ADR-007).
 */
describe("StaffService — last active OWNER protection (integration)", () => {
  const prisma = new PrismaClient();
  const staffService = new StaffService(
    prisma as unknown as PrismaService,
    new AuditLogService(prisma as unknown as PrismaService),
    new PasswordService(),
  );

  const suffix = randomUUID().slice(0, 8);
  let organizationId: string;
  let branchId: string;
  let ownerRoleId: string;
  let managerRoleId: string;
  let staffAId: string;
  let staffBId: string;
  let otherActiveOwnerIds: string[] = [];
  const ctx = {};
  const actingAdmin = { subjectType: "STAFF", id: "test-runner", email: "test@local", permissions: [] } as AuthenticatedStaff;

  beforeAll(async () => {
    // Deactivate any pre-existing active OWNER (e.g. the bootstrap seed
    // account on a dev database) for the duration of this suite — the
    // guard counts active OWNERs across the whole database, so leaving
    // one active would make every "sole owner" precondition below false.
    const preExistingOwners = await prisma.staff.findMany({
      where: { isActive: true, staffRoles: { some: { role: { name: RoleName.OWNER } } } },
      select: { id: true },
    });
    otherActiveOwnerIds = preExistingOwners.map((s) => s.id);
    if (otherActiveOwnerIds.length > 0) {
      await prisma.staff.updateMany({ where: { id: { in: otherActiveOwnerIds } }, data: { isActive: false } });
    }

    const org = await prisma.organization.create({ data: { name: `Test Org ${suffix}` } });
    organizationId = org.id;
    const branch = await prisma.branch.create({
      data: { organizationId, name: `Test Branch ${suffix}`, address: "Test", code: `TEST-${suffix}` },
    });
    branchId = branch.id;

    const ownerRole = await prisma.role.upsert({
      where: { name: RoleName.OWNER },
      update: {},
      create: { name: RoleName.OWNER },
    });
    ownerRoleId = ownerRole.id;
    const managerRole = await prisma.role.upsert({
      where: { name: RoleName.MANAGER },
      update: {},
      create: { name: RoleName.MANAGER },
    });
    managerRoleId = managerRole.id;

    // staffA starts as the ONLY active OWNER. staffB starts as MANAGER.
    const staffA = await prisma.staff.create({
      data: {
        email: `staff-a-${suffix}@test.local`,
        passwordHash: "x",
        name: "Staff A",
        staffRoles: { create: { roleId: ownerRoleId } },
        branchStaff: { create: { branchId } },
      },
    });
    staffAId = staffA.id;

    const staffB = await prisma.staff.create({
      data: {
        email: `staff-b-${suffix}@test.local`,
        passwordHash: "x",
        name: "Staff B",
        staffRoles: { create: { roleId: managerRoleId } },
        branchStaff: { create: { branchId } },
      },
    });
    staffBId = staffB.id;
  });

  afterAll(async () => {
    await prisma.staff.deleteMany({ where: { id: { in: [staffAId, staffBId] } } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    if (otherActiveOwnerIds.length > 0) {
      await prisma.staff.updateMany({ where: { id: { in: otherActiveOwnerIds } }, data: { isActive: true } });
    }
    await prisma.$disconnect();
  });

  it("blocks removing OWNER from staffA while staffA is the only active owner", async () => {
    await expect(
      staffService.assignRoles(staffAId, { roles: [RoleName.MANAGER] }, actingAdmin, ctx),
    ).rejects.toThrow(AppError);

    const stillOwner = await prisma.staffRole.findUnique({
      where: { staffId_roleId: { staffId: staffAId, roleId: ownerRoleId } },
    });
    expect(stillOwner).not.toBeNull();
  });

  it("blocks deactivating staffA while staffA is the only active owner", async () => {
    await expect(staffService.update(staffAId, { isActive: false }, actingAdmin, ctx)).rejects.toThrow(AppError);

    const stillActive = await prisma.staff.findUniqueOrThrow({ where: { id: staffAId } });
    expect(stillActive.isActive).toBe(true);
  });

  it("allows promoting staffB to OWNER (adding an owner never conflicts with the guard)", async () => {
    const updated = await staffService.assignRoles(staffBId, { roles: [RoleName.OWNER] }, actingAdmin, ctx);
    expect(updated.staffRoles.map((sr) => sr.role.name)).toEqual([RoleName.OWNER]);
  });

  it("now allows removing OWNER from staffA, since staffB is an active owner too", async () => {
    const updated = await staffService.assignRoles(staffAId, { roles: [RoleName.MANAGER] }, actingAdmin, ctx);
    expect(updated.staffRoles.map((sr) => sr.role.name)).toEqual([RoleName.MANAGER]);
  });

  it("blocks deactivating staffB now that staffB is again the only active owner", async () => {
    await expect(staffService.update(staffBId, { isActive: false }, actingAdmin, ctx)).rejects.toThrow(AppError);
  });

  it("allows deactivating staffB once staffA is promoted back to OWNER", async () => {
    await staffService.assignRoles(staffAId, { roles: [RoleName.OWNER] }, actingAdmin, ctx);

    const updated = await staffService.update(staffBId, { isActive: false }, actingAdmin, ctx);
    expect(updated.isActive).toBe(false);
  });
});
