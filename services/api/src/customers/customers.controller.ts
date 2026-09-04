import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createCustomerAddressSchema,
  updateCustomerAddressSchema,
  updateCustomerProfileSchema,
  uuidSchema,
  type CreateCustomerAddressDto,
  type UpdateCustomerAddressDto,
  type UpdateCustomerProfileDto,
} from "@shri-anandam/validation";
import { CustomersService } from "./customers.service";
import { CurrentCustomer } from "../common/decorators/current-customer.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedCustomer } from "../auth/types/authenticated-user.type";

/**
 * Customer self-service — profile and saved addresses. No
 * @RequirePermissions here: these routes require only a valid CUSTOMER
 * token (enforced by @CurrentCustomer(), which also rejects a staff
 * token), and every operation is scoped to the authenticated customer's
 * own id — never a client-supplied one.
 */
@Controller("customers/me")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  getProfile(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customers.getProfile(customer.id);
  }

  @Patch()
  updateProfile(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(updateCustomerProfileSchema)) body: UpdateCustomerProfileDto,
  ) {
    return this.customers.updateProfile(customer.id, body);
  }

  @Get("addresses")
  listAddresses(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.customers.listAddresses(customer.id);
  }

  @Post("addresses")
  createAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(createCustomerAddressSchema)) body: CreateCustomerAddressDto,
  ) {
    return this.customers.createAddress(customer.id, body);
  }

  @Patch("addresses/:id")
  updateAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) addressId: string,
    @Body(new ZodValidationPipe(updateCustomerAddressSchema)) body: UpdateCustomerAddressDto,
  ) {
    return this.customers.updateAddress(customer.id, addressId, body);
  }

  @Patch("addresses/:id/default")
  setDefaultAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) addressId: string,
  ) {
    return this.customers.setDefaultAddress(customer.id, addressId);
  }

  @Delete("addresses/:id")
  async deleteAddress(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) addressId: string,
  ) {
    await this.customers.deleteAddress(customer.id, addressId);
    return { message: "Address removed" };
  }
}
