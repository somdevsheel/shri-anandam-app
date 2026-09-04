import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";
import type { ZodSchema } from "zod";
import { ValidationError } from "../errors/app.error";

/**
 * Validates request bodies/queries/params against a Zod schema shared
 * with mobile/web clients via @shri-anandam/validation, so the exact same
 * rules run on the server regardless of what the client sent.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      throw new ValidationError("Request validation failed", details);
    }
    return result.data;
  }
}
