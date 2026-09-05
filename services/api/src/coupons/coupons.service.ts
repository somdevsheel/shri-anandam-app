import { Injectable } from "@nestjs/common";
import type { Coupon, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotFoundError, ConflictError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { CreateCouponDto, ListCouponsQueryDto, UpdateCouponDto } from "@shri-anandam/validation";
import type { CartService } from "../cart/cart.service";

/** No exported response type from CartService — inferred the same way orders.service.ts's own `cartState` is. */
type CartState = Awaited<ReturnType<CartService["getCart"]>>;

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export type CouponResolution =
  | { valid: true; coupon: Coupon; discountInPaise: number }
  | { valid: false; message: string };

/**
 * Coupon math and validation lives in exactly one place —
 * `resolveForCart` — so the customer-facing preview endpoint and
 * OrdersService.createOrder() can never disagree about whether a code
 * applies or how much it's worth.
 *
 * Deliberately NOT enforced here (v1 scope, see ADR-016's pattern of
 * stating gaps plainly rather than pretending they don't exist):
 * `CouponRule` (per-product/per-category scoping). Only the coupon's own
 * top-level fields — active window, min order, usage limits, first-order,
 * branch — are checked. A coupon with rows in `coupon_rules` today would
 * be treated as unscoped (valid cart-wide) until that's built.
 */
@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListCouponsQueryDto) {
    const where: Prisma.CouponWhereInput = { isActive: query.isActive };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.coupon.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          this.prisma.coupon.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundError("Coupon", id);
    return coupon;
  }

  async create(dto: CreateCouponDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const codeTaken = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (codeTaken) {
      throw new ConflictError(`Coupon code "${dto.code}" is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          code: dto.code,
          type: dto.type,
          value: dto.value,
          minOrderInPaise: dto.minOrderInPaise,
          maxDiscountInPaise: dto.maxDiscountInPaise,
          usageLimit: dto.usageLimit,
          perCustomerLimit: dto.perCustomerLimit,
          isFirstOrderOnly: dto.isFirstOrderOnly,
          branchId: dto.branchId,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
        },
      });

      await this.auditLog.record(
        { actor, action: "COUPON_CREATED", entityType: "Coupon", entityId: coupon.id, newValue: coupon, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return coupon;
    });
  }

  async update(id: string, dto: UpdateCouponDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.update({ where: { id }, data: dto });

      await this.auditLog.record(
        { actor, action: "COUPON_UPDATED", entityType: "Coupon", entityId: coupon.id, oldValue: existing, newValue: coupon, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return coupon;
    });
  }

  /** Coupons are referenced by CouponUsage/Order rows — deactivate, never hard-delete (same reasoning as BranchesService.deactivate). */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.update({ where: { id }, data: { isActive: false } });

      await this.auditLog.record(
        { actor, action: "COUPON_DEACTIVATED", entityType: "Coupon", entityId: coupon.id, oldValue: { isActive: true }, newValue: { isActive: false }, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
        tx,
      );

      return coupon;
    });
  }

  async resolveForCart(customerId: string, rawCode: string, cartState: Pick<CartState, "cart" | "subtotalInPaise">): Promise<CouponResolution> {
    if (!cartState.cart) {
      return { valid: false, message: "Your cart is empty" };
    }

    const code = rawCode.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) {
      return { valid: false, message: "Invalid or inactive coupon code" };
    }

    const now = new Date();
    if (now < coupon.startsAt) {
      return { valid: false, message: "This coupon isn't active yet" };
    }
    if (now > coupon.endsAt) {
      return { valid: false, message: "This coupon has expired" };
    }

    if (coupon.branchId && coupon.branchId !== cartState.cart.branchId) {
      return { valid: false, message: "This coupon isn't valid for this branch" };
    }

    if (coupon.minOrderInPaise && cartState.subtotalInPaise < coupon.minOrderInPaise) {
      return { valid: false, message: `Add ₹${(coupon.minOrderInPaise / 100).toFixed(0)} more to your cart to use this coupon` };
    }

    if (coupon.usageLimit !== null) {
      const totalUses = await this.prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalUses >= coupon.usageLimit) {
        return { valid: false, message: "This coupon has reached its usage limit" };
      }
    }

    if (coupon.perCustomerLimit !== null) {
      const customerUses = await this.prisma.couponUsage.count({ where: { couponId: coupon.id, customerId } });
      if (customerUses >= coupon.perCustomerLimit) {
        return { valid: false, message: "You've already used this coupon" };
      }
    }

    if (coupon.isFirstOrderOnly) {
      // "First order" = this customer has never placed one before,
      // regardless of what happened to it afterward (cancelled orders
      // still show intent, and re-litigating that here would need its
      // own product decision this pass doesn't make).
      const priorOrders = await this.prisma.order.count({ where: { customerId } });
      if (priorOrders > 0) {
        return { valid: false, message: "This coupon is for first-time customers only" };
      }
    }

    const rawDiscount = coupon.type === "PERCENTAGE" ? Math.round((cartState.subtotalInPaise * coupon.value) / 100) : coupon.value;
    const capped = coupon.maxDiscountInPaise ? Math.min(rawDiscount, coupon.maxDiscountInPaise) : rawDiscount;
    const discountInPaise = Math.min(capped, cartState.subtotalInPaise);

    return { valid: true, coupon, discountInPaise };
  }
}
