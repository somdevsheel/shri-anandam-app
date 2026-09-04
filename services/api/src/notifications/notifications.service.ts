import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { NotFoundError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.type";
import type { ListNotificationsQueryDto } from "@shri-anandam/validation";

/**
 * Read-side of the notification system (section 19: "Notification
 * history" in the owner app). The write side — deciding who to notify
 * and actually calling FCM — lives in services/notification-worker,
 * consuming the outbox this API never touches directly (section 21:
 * "Database is the source of truth" for orders regardless of whether a
 * push ever arrives; this API is what lets the owner app show its
 * pending-orders/notification list even if it does).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(actor: AuthenticatedUser, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput =
      actor.subjectType === "CUSTOMER"
        ? { customerId: actor.id, status: query.status }
        : { staffId: actor.id, status: query.status };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
          this.prisma.notification.count({ where }),
        ]),
    );
  }

  async markRead(actor: AuthenticatedUser, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundError("Notification", notificationId);

    const owns = actor.subjectType === "CUSTOMER" ? notification.customerId === actor.id : notification.staffId === actor.id;
    if (!owns) throw new NotFoundError("Notification", notificationId);

    if (notification.readAt) return notification; // already read — idempotent

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: "READ", readAt: new Date() },
    });
  }
}
