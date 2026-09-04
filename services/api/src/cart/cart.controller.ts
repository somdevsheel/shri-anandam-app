import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import {
  addCartItemSchema,
  updateCartItemSchema,
  uuidSchema,
  type AddCartItemDto,
  type UpdateCartItemDto,
} from "@shri-anandam/validation";
import { CartService } from "./cart.service";
import { CurrentCustomer } from "../common/decorators/current-customer.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { AuthenticatedCustomer } from "../auth/types/authenticated-user.type";

/** Customer-only, no @RequirePermissions — see customers.controller.ts for the pattern this follows. */
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentCustomer() customer: AuthenticatedCustomer) {
    return this.cart.getCart(customer.id);
  }

  @Post("items")
  addItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Body(new ZodValidationPipe(addCartItemSchema)) body: AddCartItemDto,
  ) {
    return this.cart.addItem(customer.id, body);
  }

  @Patch("items/:id")
  updateItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) itemId: string,
    @Body(new ZodValidationPipe(updateCartItemSchema)) body: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(customer.id, itemId, body);
  }

  @Delete("items/:id")
  removeItem(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param("id", new ZodValidationPipe(uuidSchema)) itemId: string,
  ) {
    return this.cart.removeItem(customer.id, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async clearCart(@CurrentCustomer() customer: AuthenticatedCustomer) {
    await this.cart.clearCart(customer.id);
    return { message: "Cart cleared" };
  }
}
