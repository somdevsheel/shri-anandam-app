import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { NotFoundError } from "../common/errors/app.error";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import type { RegisterDeviceDto } from "@shri-anandam/validation";

/**
 * section 22: multiple device tokens per user, registration, token
 * refresh, invalidation, logout, device list. The owner app in
 * particular relies on this — several owner devices (phone + tablet)
 * all getting new-order pushes, and a lost/replaced device not
 * silently accumulating dead tokens forever.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert by fcmToken (unique) — re-registering the same token (the
   * normal pattern: apps call this on every foreground/login, not just
   * once) is a no-op refresh of lastActiveAt. If the SAME physical
   * token now belongs to a different logged-in user (e.g. staff A logs
   * out, staff B logs into the same device), ownership is reassigned
   * rather than left pointing at the wrong account.
   */
  async register(actor: AuthenticatedUser, dto: RegisterDeviceDto) {
    const ownerFields =
      actor.subjectType === "CUSTOMER" ? { customerId: actor.id, staffId: null } : { staffId: actor.id, customerId: null };

    return this.prisma.deviceToken.upsert({
      where: { fcmToken: dto.fcmToken },
      create: { fcmToken: dto.fcmToken, platform: dto.platform, appType: dto.appType, ...ownerFields },
      update: { platform: dto.platform, appType: dto.appType, isActive: true, lastActiveAt: new Date(), ...ownerFields },
    });
  }

  async listMine(actor: AuthenticatedUser) {
    const where = actor.subjectType === "CUSTOMER" ? { customerId: actor.id } : { staffId: actor.id };
    return this.prisma.deviceToken.findMany({ where, orderBy: { lastActiveAt: "desc" } });
  }

  /** "Logout this device" — deactivates without deleting, preserving notification history's device reference. */
  async deactivate(actor: AuthenticatedUser, deviceId: string) {
    const device = await this.prisma.deviceToken.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundError("DeviceToken", deviceId);

    const owns = actor.subjectType === "CUSTOMER" ? device.customerId === actor.id : device.staffId === actor.id;
    if (!owns) throw new NotFoundError("DeviceToken", deviceId);

    await this.prisma.deviceToken.update({ where: { id: deviceId }, data: { isActive: false } });
  }
}
