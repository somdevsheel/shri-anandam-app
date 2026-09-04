import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { updateOrganizationSchema, type UpdateOrganizationDto } from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { OrganizationsService } from "./organizations.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

@Controller("organization")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @RequirePermissions(Permission.ORGANIZATION_READ)
  getCurrent() {
    return this.organizations.getCurrent();
  }

  @Patch()
  @RequirePermissions(Permission.ORGANIZATION_UPDATE)
  update(
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.organizations.updateCurrent(body, user, requestContext(req));
  }
}
