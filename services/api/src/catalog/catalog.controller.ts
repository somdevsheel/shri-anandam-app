import { Controller, Get, Param, Query } from "@nestjs/common";
import { browseCatalogProductsQuerySchema, type BrowseCatalogProductsQueryDto } from "@shri-anandam/validation";
import { CatalogService } from "./catalog.service";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Public()
  @Get("products")
  listProducts(@Query(new ZodValidationPipe(browseCatalogProductsQuerySchema)) query: BrowseCatalogProductsQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Public()
  @Get("products/:slug")
  getProductBySlug(@Param("slug") slug: string) {
    return this.catalog.getProductBySlug(slug);
  }
}
