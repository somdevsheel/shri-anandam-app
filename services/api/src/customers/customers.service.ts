import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type {
  CreateCustomerAddressDto,
  ListCustomersAdminQueryDto,
  UpdateCustomerAddressDto,
  UpdateCustomerAdminDto,
  UpdateCustomerProfileDto,
} from "@shri-anandam/validation";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async getProfile(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } },
    });
    if (!customer) throw new NotFoundError("Customer", customerId);
    return customer;
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    return this.prisma.customer.update({ where: { id: customerId }, data: dto });
  }

  async listAddresses(customerId: string) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(customerId: string, dto: CreateCustomerAddressDto) {
    const existingCount = await this.prisma.customerAddress.count({ where: { customerId } });
    // The customer's very first address is always the default, regardless
    // of what the client sent — there's no meaningful "not default" state
    // when it's the only address.
    const isDefault = existingCount === 0 ? true : dto.isDefault;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.customerAddress.create({
        data: {
          customerId,
          label: dto.label,
          contactName: dto.contactName,
          contactPhone: dto.contactPhone,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault,
        },
      });
    });
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateCustomerAddressDto) {
    await this.getOwnedAddress(customerId, addressId);
    return this.prisma.customerAddress.update({ where: { id: addressId }, data: dto });
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    await this.getOwnedAddress(customerId, addressId);
    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } });
      return tx.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } });
    });
  }

  /**
   * Hard delete is safe here — unlike catalog/staff entities, an order's
   * address is preserved as an immutable OrderAddressSnapshot at order
   * time (section 10), so deleting a saved CustomerAddress can never
   * corrupt historical order data.
   */
  async deleteAddress(customerId: string, addressId: string) {
    const address = await this.getOwnedAddress(customerId, addressId);

    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.delete({ where: { id: addressId } });

      if (address.isDefault) {
        const nextDefault = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: "desc" },
        });
        if (nextDefault) {
          await tx.customerAddress.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // Admin (Phase 9) — a staff member looking up ANY customer.
  // ---------------------------------------------------------------------

  async listAdmin(query: ListCustomersAdminQueryDto) {
    const where: Prisma.CustomerWhereInput = {
      isActive: query.isActive,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { mobileNumber: { contains: query.search } },
          ]
        : undefined,
    };

    return paginate({ page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder }, ({ skip, take }) =>
      this.prisma.$transaction([
        this.prisma.customer.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        this.prisma.customer.count({ where }),
      ]),
    );
  }

  async getAdminDetail(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } },
    });
    if (!customer) throw new NotFoundError("Customer", customerId);

    // A lightweight lifetime-value summary for the admin detail screen —
    // cancelled/rejected orders don't count as "spend". Deliberately not
    // exposed on the customer's own profile endpoint above; this is
    // admin-only context.
    const orderStats = await this.prisma.order.aggregate({
      where: { customerId, status: { notIn: ["CANCELLED", "REJECTED"] } },
      _count: { id: true },
      _sum: { totalInPaise: true },
    });

    return {
      ...customer,
      orderCount: orderStats._count.id,
      totalSpentInPaise: orderStats._sum.totalInPaise ?? 0,
    };
  }

  async updateAdmin(customerId: string, dto: UpdateCustomerAdminDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw new NotFoundError("Customer", customerId);

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({ where: { id: customerId }, data: dto });

      await this.auditLog.record(
        {
          actor,
          action: "CUSTOMER_UPDATED",
          entityType: "Customer",
          entityId: customer.id,
          oldValue: { isActive: existing.isActive },
          newValue: { isActive: customer.isActive },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return customer;
    });
  }

  private async getOwnedAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundError("CustomerAddress", addressId);
    if (address.customerId !== customerId) {
      // Deliberately the same NotFoundError as "doesn't exist" — a
      // customer probing another customer's address id should learn
      // nothing about whether that id is valid.
      throw new NotFoundError("CustomerAddress", addressId);
    }
    return address;
  }
}
