import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { Permission } from "@shri-anandam/shared-types";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { S3UploadService, ALLOWED_IMAGE_MIME_TYPES } from "./s3-upload.service";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB — a product photo has no business being bigger than this

@Controller("uploads")
export class UploadsController {
  constructor(private readonly s3: S3UploadService) {}

  /**
   * Returns a URL, doesn't attach it to a product — the existing
   * POST /products/:id/images (ProductsController) still does that, with
   * its own createProductImageSchema validation. Kept as two steps
   * rather than one combined endpoint: a product might not exist yet
   * (new-product form uploads an image before the product is created),
   * and this endpoint has nothing product-specific to know about.
   */
  @Post("product-image")
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          callback(new BadRequestException(`Unsupported image type: ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded — send it as multipart/form-data under the field name \"file\".");
    }
    return this.s3.uploadProductImage(file.buffer, file.mimetype);
  }
}
