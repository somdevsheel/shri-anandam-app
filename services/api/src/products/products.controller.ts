import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  assignProductAddonsSchema,
  assignProductBranchesSchema,
  createProductImageSchema,
  createProductSchema,
  createProductVariantSchema,
  listProductsAdminQuerySchema,
  updateProductSchema,
  updateProductVariantSchema,
  uuidSchema,
  type AssignProductAddonsDto,
  type AssignProductBranchesDto,
  type CreateProductDto,
  type CreateProductImageDto,
  type CreateProductVariantDto,
  type ListProductsAdminQueryDto,
  type UpdateProductDto,
  type UpdateProductVariantDto,
} from "@shri-anandam/validation";
import { Permission } from "@shri-anandam/shared-types";
import { ProductsService } from "./products.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { requestContext } from "../common/util/request-context";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";

/** Admin product management — see src/catalog for public customer browsing. */
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(@Query(new ZodValidationPipe(listProductsAdminQuerySchema)) query: ListProductsAdminQueryDto) {
    return this.products.list(query);
  }

  @Get(":id")
  @RequirePermissions(Permission.PRODUCT_READ)
  getById(@Param("id", new ZodValidationPipe(uuidSchema)) id: string) {
    return this.products.getById(id);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCT_CREATE)
  create(
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.create(body, user, requestContext(req));
  }

  @Patch(":id")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  update(
    @Param("id", new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.update(id, body, user, requestContext(req));
  }

  @Delete(":id")
  @RequirePermissions(Permission.PRODUCT_DELETE)
  deactivate(@Param("id", new ZodValidationPipe(uuidSchema)) id: string, @CurrentUser() user: AuthenticatedStaff, @Req() req: Request) {
    return this.products.deactivate(id, user, requestContext(req));
  }

  // --- Variants ---

  @Post(":id/variants")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  addVariant(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Body(new ZodValidationPipe(createProductVariantSchema)) body: CreateProductVariantDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.addVariant(productId, body, user, requestContext(req));
  }

  @Patch(":id/variants/:variantId")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  updateVariant(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Param("variantId", new ZodValidationPipe(uuidSchema)) variantId: string,
    @Body(new ZodValidationPipe(updateProductVariantSchema)) body: UpdateProductVariantDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.updateVariant(productId, variantId, body, user, requestContext(req));
  }

  @Delete(":id/variants/:variantId")
  @RequirePermissions(Permission.PRODUCT_DELETE)
  removeVariant(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Param("variantId", new ZodValidationPipe(uuidSchema)) variantId: string,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.removeVariant(productId, variantId, user, requestContext(req));
  }

  // --- Images ---

  @Post(":id/images")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  addImage(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Body(new ZodValidationPipe(createProductImageSchema)) body: CreateProductImageDto,
  ) {
    return this.products.addImage(productId, body);
  }

  @Delete(":id/images/:imageId")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @HttpCode(HttpStatus.OK)
  async removeImage(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Param("imageId", new ZodValidationPipe(uuidSchema)) imageId: string,
  ) {
    await this.products.removeImage(productId, imageId);
    return { message: "Image removed" };
  }

  // --- Addon / branch assignment ---

  @Patch(":id/addons")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  assignAddons(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Body(new ZodValidationPipe(assignProductAddonsSchema)) body: AssignProductAddonsDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.assignAddons(productId, body, user, requestContext(req));
  }

  @Patch(":id/branches")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  assignBranches(
    @Param("id", new ZodValidationPipe(uuidSchema)) productId: string,
    @Body(new ZodValidationPipe(assignProductBranchesSchema)) body: AssignProductBranchesDto,
    @CurrentUser() user: AuthenticatedStaff,
    @Req() req: Request,
  ) {
    return this.products.assignBranches(productId, body, user, requestContext(req));
  }
}
