import { z } from "zod";

const platformSchema = z.enum(["ANDROID", "IOS", "WEB"]);
const appTypeSchema = z.enum(["CUSTOMER", "OWNER", "ADMIN", "KITCHEN"]);

/**
 * Registers (or refreshes) a device's FCM push token — section 22:
 * "Support multiple device tokens, device registration, token refresh."
 * Re-registering the SAME fcmToken (e.g. on every app foreground, which
 * is the normal Expo/FCM pattern) is idempotent by design — see
 * DevicesService.register()'s upsert-by-fcmToken behavior.
 */
export const registerDeviceSchema = z.object({
  fcmToken: z.string().trim().min(10).max(500),
  platform: platformSchema,
  appType: appTypeSchema,
});
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
