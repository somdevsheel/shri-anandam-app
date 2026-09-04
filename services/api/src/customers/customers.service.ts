import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { NotFoundError } from "../common/errors/app.error";
import type {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  UpdateCustomerProfileDto,
} from "@shri-anandam/validation";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
