import { z } from "zod";
import { paginationQuerySchema } from "./common.schema";

/** Branch code — short uppercase identifier, e.g. "SA-MAIN", "SA-KPHB". Used in reporting and staff-facing UI, not just an internal id. */
export const branchCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Branch code must be 2-20 uppercase letters/digits/hyphens");

export const createBranchSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: branchCodeSchema,
  address: z.string().trim().min(1).max(500),
  phone: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type CreateBranchDto = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;

export const listBranchesQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});
export type ListBranchesQueryDto = z.infer<typeof listBranchesQuerySchema>;
