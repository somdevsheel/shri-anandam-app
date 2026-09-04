/**
 * Idempotent database seed: RBAC roles/permissions, a default
 * Organization + Branch, and (in non-production only) a bootstrap OWNER
 * staff account so there is a way to log into the admin panel on a fresh
 * database. Run via `pnpm prisma:seed`.
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { DEFAULT_ROLE_PERMISSIONS, Permission, Role } from "@shri-anandam/shared-types";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const key of Object.values(Permission)) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
}

async function seedRoles() {
  for (const roleName of Object.values(Role)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedOrganization() {
  const existing = await prisma.organization.findFirst();
  if (existing) return existing;

  return prisma.organization.create({
    data: {
      name: "Shri Anandam Sweets & Restaurant",
      branches: {
        create: {
          name: "Main Branch",
          code: "SA-MAIN",
          address: "Configure the real address in the admin panel",
        },
      },
    },
  });
}

async function seedBootstrapOwner() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping bootstrap OWNER seed in production — create the first OWNER manually.");
    return;
  }

  const email = process.env.SEED_OWNER_EMAIL ?? "owner@shrianandam.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) return;

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: Role.OWNER } });
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.staff.create({
    data: {
      email,
      passwordHash,
      name: "Owner",
      staffRoles: { create: { roleId: ownerRole.id } },
    },
  });

  console.log(`Seeded bootstrap OWNER account: ${email} / ${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedOrganization();
  await seedBootstrapOwner();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
