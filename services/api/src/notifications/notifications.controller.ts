import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { listNotificationsQuerySchema, uuidSchema, type ListNotificationsQueryDto } from "@shri-anandam/validation";
import { NotificationsService } from "./notifications.service";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.type";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser, @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQueryDto) {
    return this.notifications.listMine(user, query);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.notifications.markRead(user, id);
  }
}
