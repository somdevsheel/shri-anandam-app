import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

/** RFC 4122 UUID path/body param. */
export const uuidSchema = z.string().uuid();

/** Client-supplied idempotency key for state-changing requests (section 11). */
export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Idempotency-Key must be alphanumeric with - or _");
