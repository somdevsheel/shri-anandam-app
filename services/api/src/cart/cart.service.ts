import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { ConflictError, NotFoundError, ValidationError } from "../common/errors/app.error";
import type { AddCartItemDto, UpdateCartItemDto } from "@shri-anandam/validation";

const CART_INCLUDE = {
  branch: true,
  items: {
    include: {
      product: true,
      variant: true,
      addons: { include: { addon: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.CartInclude;

export interface CartLineIssue {
  cartItemId: string;
  code:
    | "PRODUCT_UNAVAILABLE"
    | "VARIANT_UNAVAILABLE"
    | "NOT_SOLD_AT_BRANCH"
    | "INSUFFICIENT_STOCK"
    | "ADDON_UNAVAILABLE"
    | "PRICE_NOT_SET";
  message: string;
}

/**
 * Server-aware cart (section 6): a CartItem never stores a price. Every
 * read recomputes each line from the CURRENT ProductVariant/Addon price,
 * so "stale cached price" is structurally impossible rather than merely
 * avoided — the same principle checkout (Phase 6) applies again,
 * authoritatively, at order-creation time. This service also surfaces
 * availability problems (deactivated product, out of stock, branch
 * mismatch) as `issues` on every read rather than only at checkout, so
 * the cart screen can show "3 left" or "no longer available" live.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getCart(customerId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { customerId }, include: CART_INCLUDE });
    if (!cart) {
      return { cart: null, subtotalInPaise: 0, itemCount: 0, issues: [] as CartLineIssue[] };
    }
    return this.priceCart(cart);
  }

  async addItem(customerId: string, dto: AddCartItemDto) {
    const [product, variant] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
      this.prisma.productVariant.findUnique({ where: { id: dto.variantId } }),
    ]);
    if (!product || !product.isActive) {
      throw new ValidationError("Product is not available", [{ field: "productId", message: "Unknown or inactive product" }]);
    }
    if (!variant || !variant.isActive || variant.productId !== dto.productId) {
      throw new ValidationError("Variant is not available", [{ field: "variantId", message: "Unknown or inactive variant" }]);
    }
    if (variant.priceInPaise === null) {
      // "TBD" — the admin hasn't set a real price yet. Never let this
      // reach a cart/order regardless of what the browsing screens show.
      throw new ValidationError("This item's price hasn't been set yet — it can't be ordered", [
        { field: "variantId", message: "Price not configured" },
      ]);
    }

    let cart = await this.prisma.cart.findUnique({ where: { customerId } });
    const branchId = cart?.branchId;
    if (cart && branchId !== dto.branchId) {
      throw new ConflictError(
        "Your cart has items from a different branch — clear your cart before ordering from this branch",
      );
    }

    const branchProduct = await this.prisma.branchProduct.findUnique({
      where: { branchId_productId: { branchId: dto.branchId, productId: dto.productId } },
    });
    if (!branchProduct || !branchProduct.isActive) {
      throw new ValidationError("This product isn't sold at the selected branch", [
        { field: "productId", message: "Not available at this branch" },
      ]);
    }

    // Variant-level branch availability is opt-in: a variant with no
    // BranchProductVariant rows at all is available at every branch the
    // product itself is assigned to (matches the pre-existing behavior
    // before this table existed — most products/variants will never
    // need a per-branch override). Only once a variant has at least one
    // row does branch assignment become an explicit allow-list.
    const variantBranchRows = await this.prisma.branchProductVariant.findMany({ where: { productVariantId: dto.variantId } });
    if (variantBranchRows.length > 0) {
      const allowedHere = variantBranchRows.find((bv) => bv.branchId === dto.branchId);
      if (!allowedHere || !allowedHere.isActive) {
        throw new ValidationError("This option isn't sold at the selected branch", [
          { field: "variantId", message: "Not available at this branch" },
        ]);
      }
    }

    if (dto.quantity < variant.minOrderQuantity) {
      throw new ValidationError(`Minimum order quantity for this item is ${variant.minOrderQuantity}`, [
        { field: "quantity", message: `Must be at least ${variant.minOrderQuantity}` },
      ]);
    }
    if (variant.maxOrderQuantity !== null && dto.quantity > variant.maxOrderQuantity) {
      throw new ValidationError(`Maximum order quantity for this item is ${variant.maxOrderQuantity}`, [
        { field: "quantity", message: `Must be at most ${variant.maxOrderQuantity}` },
      ]);
    }

    if (dto.addonIds.length > 0) {
      const addons = await this.prisma.addon.findMany({ where: { id: { in: dto.addonIds } } });
      const resolvedIds = new Set(addons.filter((a) => a.isActive).map((a) => a.id));
      const missing = dto.addonIds.filter((id) => !resolvedIds.has(id));
      if (missing.length > 0) {
        throw new ValidationError(
          "One or more add-ons are unavailable",
          missing.map((id) => ({ field: "addonIds", message: `Unknown or inactive add-on: ${id}` })),
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (!cart) {
        cart = await tx.cart.create({ data: { customerId, branchId: dto.branchId } });
      }

      const sortedAddonIds = [...dto.addonIds].sort();
      const existingLine = await this.findMatchingLine(tx, cart.id, dto.variantId, sortedAddonIds, dto.specialInstructions);

      if (existingLine) {
        const combinedQuantity = existingLine.quantity + dto.quantity;
        if (variant.maxOrderQuantity !== null && combinedQuantity > variant.maxOrderQuantity) {
          throw new ValidationError(`Maximum order quantity for this item is ${variant.maxOrderQuantity}`, [
            { field: "quantity", message: `Must be at most ${variant.maxOrderQuantity} in total` },
          ]);
        }
        await tx.cartItem.update({
          where: { id: existingLine.id },
          data: { quantity: combinedQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: dto.productId,
            variantId: dto.variantId,
            quantity: dto.quantity,
            specialInstructions: dto.specialInstructions,
            addons: { create: dto.addonIds.map((addonId) => ({ addonId })) },
          },
        });
      }

      const refreshed = await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: CART_INCLUDE });
      return this.priceCart(refreshed);
    });
  }

  async updateItem(customerId: string, cartItemId: string, dto: UpdateCartItemDto) {
    const item = await this.getOwnedItem(customerId, cartItemId);

    if (dto.quantity !== undefined) {
      const variant = await this.prisma.productVariant.findUniqueOrThrow({ where: { id: item.variantId } });
      if (dto.quantity < variant.minOrderQuantity) {
        throw new ValidationError(`Minimum order quantity for this item is ${variant.minOrderQuantity}`, [
          { field: "quantity", message: `Must be at least ${variant.minOrderQuantity}` },
        ]);
      }
      if (variant.maxOrderQuantity !== null && dto.quantity > variant.maxOrderQuantity) {
        throw new ValidationError(`Maximum order quantity for this item is ${variant.maxOrderQuantity}`, [
          { field: "quantity", message: `Must be at most ${variant.maxOrderQuantity}` },
        ]);
      }
    }

    if (dto.addonIds) {
      const addons = await this.prisma.addon.findMany({ where: { id: { in: dto.addonIds } } });
      const resolvedIds = new Set(addons.filter((a) => a.isActive).map((a) => a.id));
      const missing = dto.addonIds.filter((id) => !resolvedIds.has(id));
      if (missing.length > 0) {
        throw new ValidationError(
          "One or more add-ons are unavailable",
          missing.map((id) => ({ field: "addonIds", message: `Unknown or inactive add-on: ${id}` })),
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.update({
        where: { id: cartItemId },
        data: {
          quantity: dto.quantity,
          specialInstructions: dto.specialInstructions,
        },
      });

      if (dto.addonIds) {
        await tx.cartItemAddon.deleteMany({ where: { cartItemId } });
        await tx.cartItemAddon.createMany({ data: dto.addonIds.map((addonId) => ({ cartItemId, addonId })) });
      }
    });

    const cart = await this.prisma.cart.findUniqueOrThrow({ where: { id: item.cartId }, include: CART_INCLUDE });
    return this.priceCart(cart);
  }

  async removeItem(customerId: string, cartItemId: string) {
    const item = await this.getOwnedItem(customerId, cartItemId);
    await this.prisma.cartItem.delete({ where: { id: cartItemId } });

    const cart = await this.prisma.cart.findUnique({ where: { id: item.cartId }, include: CART_INCLUDE });
    if (!cart) return { cart: null, subtotalInPaise: 0, itemCount: 0, issues: [] as CartLineIssue[] };
    return this.priceCart(cart);
  }

  async clearCart(customerId: string) {
    await this.prisma.cart.deleteMany({ where: { customerId } });
  }

  private async getOwnedItem(customerId: string, cartItemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: cartItemId }, include: { cart: true } });
    if (!item || item.cart.customerId !== customerId) {
      throw new NotFoundError("CartItem", cartItemId);
    }
    return item;
  }

  private async findMatchingLine(
    tx: Prisma.TransactionClient,
    cartId: string,
    variantId: string,
    sortedAddonIds: string[],
    specialInstructions: string | undefined,
  ) {
    const candidates = await tx.cartItem.findMany({
      where: { cartId, variantId, specialInstructions: specialInstructions ?? null },
      include: { addons: true },
    });
    return candidates.find((c) => {
      const candidateAddonIds = c.addons.map((a) => a.addonId).sort();
      return (
        candidateAddonIds.length === sortedAddonIds.length &&
        candidateAddonIds.every((id, i) => id === sortedAddonIds[i])
      );
    });
  }

  /**
   * Recomputes every line's price from the CURRENT variant/addon prices
   * (never a stored value) and flags availability problems. Never
   * throws — an unavailable line is surfaced as an issue so the customer
   * can fix their cart, not a hard error that blocks viewing it.
   */
  private async priceCart(
    cart: Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>,
  ) {
    const issues: CartLineIssue[] = [];
    let subtotalInPaise = 0;
    let itemCount = 0;

    const items = await Promise.all(
      cart.items.map(async (item) => {
        if (!item.product.isActive) {
          issues.push({ cartItemId: item.id, code: "PRODUCT_UNAVAILABLE", message: `${item.product.name} is no longer available` });
        } else if (!item.variant.isActive) {
          issues.push({ cartItemId: item.id, code: "VARIANT_UNAVAILABLE", message: `${item.variant.name} is no longer available` });
        }

        const inactiveAddon = item.addons.find((a) => !a.addon.isActive);
        if (inactiveAddon) {
          issues.push({
            cartItemId: item.id,
            code: "ADDON_UNAVAILABLE",
            message: `${inactiveAddon.addon.name} is no longer available`,
          });
        }

        const available = await this.inventory.getAvailableQuantity(cart.branchId, item.variantId);
        if (available !== null && available.lessThan(item.quantity)) {
          issues.push({
            cartItemId: item.id,
            code: "INSUFFICIENT_STOCK",
            message: `Only ${available.toString()} of ${item.variant.name} left`,
          });
        }

        // Guarded even though addItem() refuses to add a TBD-priced
        // variant in the first place — an admin can still clear an
        // already-in-someone's-cart variant's price back to TBD later.
        // Matches this method's own "never throw, surface as an issue"
        // rule: excluded from the subtotal rather than crashing the
        // whole cart read.
        if (item.variant.priceInPaise === null) {
          issues.push({ cartItemId: item.id, code: "PRICE_NOT_SET", message: `${item.variant.name}'s price hasn't been set yet — remove it to check out` });
        }

        const addonTotalInPaise = item.addons.reduce((sum, a) => sum + a.addon.priceInPaise, 0);
        const lineTotalInPaise = item.variant.priceInPaise === null ? 0 : (item.variant.priceInPaise + addonTotalInPaise) * item.quantity;
        subtotalInPaise += lineTotalInPaise;
        itemCount += item.quantity;

        return {
          id: item.id,
          product: { id: item.product.id, name: item.product.name, slug: item.product.slug },
          variant: {
            id: item.variant.id,
            name: item.variant.name,
            priceInPaise: item.variant.priceInPaise,
            gstRatePercent: item.variant.gstRatePercent,
          },
          addons: item.addons.map((a) => ({ id: a.addon.id, name: a.addon.name, priceInPaise: a.addon.priceInPaise })),
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          unitPriceInPaise: item.variant.priceInPaise === null ? null : item.variant.priceInPaise + addonTotalInPaise,
          lineTotalInPaise,
        };
      }),
    );

    return {
      cart: { id: cart.id, branchId: cart.branchId, branch: cart.branch, items },
      subtotalInPaise,
      itemCount,
      issues,
    };
  }
}
