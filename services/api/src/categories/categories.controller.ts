import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
  uuidSchema,
  type CreateCategoryDto,
  type ListCategoriesQueryDto,
  type UpdateCategoryDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { CategoriesService } from "./categories.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

/**
 * Admin category management. Categories share the product.* permission
 * set (no dedicated category.* permissions) — they only exist to
 * organize the catalog, and anyone allowed to manage products is
 * expected to manage the categories products live in; see
 * docs/architecture/decisions.md.
 */
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(@Query(new ZodValidationPipe(listCategoriesQuerySchema)) query: ListCategoriesQueryDto) {
    return this.categories.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.PRODUCT_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.categories.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCT_CREATE)
  create(
    @Body(new ZodValidationPipe(createCategorySchema)) body: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.categories.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) body: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.categories.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.PRODUCT_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.categories.deactivate(id, user, requestContext(req));
  }
}
