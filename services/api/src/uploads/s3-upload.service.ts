import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { ServiceUnavailableError, ValidationError } from "../common/errors/app.error";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME_TYPE);

/**
 * Real S3 integration — same "fail closed with a clear error, not a
 * silent crash" shape as services/notification-worker's
 * FcmNotificationProvider: without S3_BUCKET/S3_ACCESS_KEY_ID/
 * S3_SECRET_ACCESS_KEY configured, the client is never constructed and
 * every upload attempt throws ServiceUnavailableError (503) with a
 * message that says exactly what's missing, rather than crashing the
 * whole app at boot over an optional feature.
 *
 * Uploads always go under the `products/` prefix — that's the only
 * prefix the bucket policy grants public GET on (see
 * docs/architecture/production-architecture.md's Object storage
 * section). Uploading anywhere else would silently produce an
 * inaccessible image URL.
 */
@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly region: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>("S3_BUCKET");
    this.region = config.get<string>("S3_REGION") ?? "ap-south-1";
    const accessKeyId = config.get<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = config.get<string>("S3_SECRET_ACCESS_KEY");
    const endpoint = config.get<string>("S3_ENDPOINT") || undefined;

    if (!this.bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn("S3 credentials not configured — image uploads will fail closed until S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are set (see .env.example)");
      this.client = null;
      return;
    }

    this.client = new S3Client({ region: this.region, endpoint, credentials: { accessKeyId, secretAccessKey } });
  }

  async uploadProductImage(buffer: Buffer, mimeType: string): Promise<{ url: string }> {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableError("Image upload is not configured on this server — an admin needs to set S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY.");
    }

    const extension = EXTENSION_BY_MIME_TYPE[mimeType];
    if (!extension) {
      // Guarded again here (not just at the controller's file filter) —
      // this is the boundary that actually decides the S3 key/URL, so it
      // shouldn't trust an upstream check alone. A bad mime type is the
      // caller's fault (400), not a server-configuration problem (503).
      throw new ValidationError(`Unsupported image type: ${mimeType}`);
    }

    const key = `products/${randomUUID()}.${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return { url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}` };
  }

  /**
   * Best-effort cleanup when a ProductImage row is deleted — a URL saved
   * on a Product isn't guaranteed to be one this service ever uploaded
   * (createProductImageSchema accepts any valid URL, so an admin can
   * still paste an external one), so this only deletes objects whose URL
   * matches exactly what uploadProductImage() itself would have
   * generated for the current bucket/region; anything else is silently
   * left alone. Never throws — a failed cleanup shouldn't fail the
   * (already-committed) DB deletion that triggered it, it just leaves an
   * orphaned object for later.
   */
  async deleteIfOwnedByUs(url: string): Promise<void> {
    if (!this.client || !this.bucket) return;

    const prefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/products/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(`https://${this.bucket}.s3.${this.region}.amazonaws.com/`.length);

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete S3 object for removed product image (${key}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
