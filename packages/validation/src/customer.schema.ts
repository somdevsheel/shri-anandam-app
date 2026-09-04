import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});
export type UpdateCustomerProfileDto = z.infer<typeof updateCustomerProfileSchema>;

const indianPincodeSchema = z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code");

export const createCustomerAddressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  contactName: z.string().trim().min(1).max(150),
  contactPhone: z.string().trim().regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number in +91XXXXXXXXXX format"),
  line1: z.string().trim().min(1).max(300),
  line2: z.string().trim().max(300).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode: indianPincodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
});
export type CreateCustomerAddressDto = z.infer<typeof createCustomerAddressSchema>;

export const updateCustomerAddressSchema = z.object({
  label: z.string().trim().max(50).nullable().optional(),
  contactName: z.string().trim().min(1).max(150).optional(),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number in +91XXXXXXXXXX format")
    .optional(),
  line1: z.string().trim().min(1).max(300).optional(),
  line2: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().min(1).max(100).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  pincode: indianPincodeSchema.optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});
export type UpdateCustomerAddressDto = z.infer<typeof updateCustomerAddressSchema>;

export const addressIdParamSchema = uuidSchema;

// ---------------------------------------------------------------------------
// Admin (Phase 9) — a staff member looking up ANY customer, distinct from
// the customer-scoped routes above which are always implicitly "me".
// ---------------------------------------------------------------------------

export const listCustomersAdminQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  /** Matches against name or mobileNumber (see CustomersService.listAdmin). */
  search: z.string().trim().max(150).optional(),
});
export type ListCustomersAdminQueryDto = z.infer<typeof listCustomersAdminQuerySchema>;

export const updateCustomerAdminSchema = z.object({
  isActive: z.boolean().optional(),
});
export type UpdateCustomerAdminDto = z.infer<typeof updateCustomerAdminSchema>;
