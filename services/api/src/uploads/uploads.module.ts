import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { S3UploadService } from "./s3-upload.service";

@Module({
  controllers: [UploadsController],
  providers: [S3UploadService],
  // ProductsModule imports this to best-effort-clean-up S3 objects when a
  // ProductImage row is deleted — see S3UploadService.deleteIfOwnedByUs.
  exports: [S3UploadService],
})
export class UploadsModule {}
