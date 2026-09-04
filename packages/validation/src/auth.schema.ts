import { z } from "zod";

/** E.164-ish Indian mobile number: +91 followed by 10 digits starting 6-9. */
export const mobileNumberSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, "Enter a valid Indian mobile number in +91XXXXXXXXXX format");

export const requestOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
});
export type RequestOtpDto = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  mobileNumber: mobileNumberSchema,
  otp: z.string().regex(/^\d{4,8}$/, "OTP must be numeric"),
  /** Present when the client already holds a pending customer profile (name capture on first login). */
  name: z.string().trim().min(1).max(120).optional(),
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type StaffLoginDto = z.infer<typeof staffLoginSchema>;
