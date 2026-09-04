import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { registerDeviceSchema, uuidSchema, type RegisterDeviceDto } from "@shri-anandam/validation";
import { DevicesService } from "./devices.service";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.type";

/** No @RequirePermissions() — any authenticated user (customer or staff) manages their own devices. */
@Controller("devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceDto) {
    return this.devices.register(user, body);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.devices.listMine(user);
  }

  @Delete(":id")
  async deactivate(@CurrentUser() user: AuthenticatedUser, @Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    await this.devices.deactivate(user, id);
    return { message: "Device logged out" };
  }
}
