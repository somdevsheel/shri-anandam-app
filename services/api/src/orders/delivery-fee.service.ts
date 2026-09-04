import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { ValidationError } from "../common/errors/app.error";

export interface DeliveryFeeResult {
  deliveryFeeInPaise: number;
  zoneName: string;
}

/**
 * Resolves a delivery fee for a branch + pincode + order subtotal
 * (section 55). Tiered DeliveryChargeRule surcharges are intentionally
 * not applied yet — only a zone's flat deliveryFeeInPaise/
 * freeDeliveryThresholdInPaise — that's a bounded, honest slice of the
 * full delivery-area feature; layering tiered rules on top is additive,
 * not a redesign, whenever that admin screen (section 25) gets built.
 */
@Injectable()
export class DeliveryFeeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(branchId: string, pincode: string, subtotalInPaise: number): Promise<DeliveryFeeResult> {
    const zones = await this.prisma.deliveryZone.findMany({ where: { branchId, isActive: true } });
    const zone = zones.find((z) => z.pincodes.includes(pincode));

    if (!zone) {
      throw new ValidationError("We don't deliver to this address yet", [
        { field: "addressId", message: `No delivery zone covers PIN code ${pincode} for this branch` },
      ]);
    }

    if (subtotalInPaise < zone.minOrderInPaise) {
      throw new ValidationError("Order does not meet the minimum for delivery to this area", [
        { field: "addressId", message: `Minimum order for ${zone.name} is ₹${(zone.minOrderInPaise / 100).toFixed(2)}` },
      ]);
    }

    const freeDeliveryReached =
      zone.freeDeliveryThresholdInPaise != null && subtotalInPaise >= zone.freeDeliveryThresholdInPaise;

    return {
      deliveryFeeInPaise: freeDeliveryReached ? 0 : zone.deliveryFeeInPaise,
      zoneName: zone.name,
    };
  }
}
