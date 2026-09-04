import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { apiRequest } from "@/api/client";
import type { DeviceToken } from "@/api/types";

/**
 * Registers this device for push (section 22). Deliberately gets a raw
 * native push token via `getDevicePushTokenAsync()`, NOT an Expo push
 * token from `getExpoPushTokenAsync()` — services/notification-worker
 * calls firebase-admin's messaging API directly with the token it's
 * given (see ADR-018), which requires a real FCM registration token, not
 * one shaped for Expo's own push relay service.
 *
 * Requires a real Firebase project wired in (google-services.json on
 * Android, APNs key + FCM on iOS — see app.config.ts's commented-out
 * `googleServicesFile`) and a native/EAS build, not Expo Go, to actually
 * produce a token — this repo has neither provisioned (same honest
 * limitation as services/notification-worker's empty FCM_* env vars).
 * Every call in this module is written to fail closed and non-fatally:
 * the app must keep working with push simply absent, exactly like the
 * backend keeps working with FCM send failing closed.
 */
const ORDER_CHANNEL_ID = "new_orders"; // must match services/notification-worker's notification-templates.ts

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
    name: "New orders & alerts",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function registerForPushNotifications(): Promise<{ token: string; platform: "ANDROID" | "IOS" } | null> {
  try {
    if (!Device.isDevice) {
      // Simulators/emulators don't have a real push token — this is
      // expected during development, not an error to surface to staff.
      return null;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") return null;

    await ensureAndroidChannel();

    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
    return { token: tokenResponse.data, platform };
  } catch {
    // No native FCM config present (no google-services.json / not a
    // dev-client or standalone build) — fails closed, same principle as
    // FcmNotificationProvider.send() on the backend when credentials
    // are absent.
    return null;
  }
}

/**
 * Registers the device with the backend (POST /devices) if a real push
 * token could be obtained. Called after login and on app foreground so a
 * token refresh (which does happen, per FCM's own docs) stays in sync.
 * Never throws — a failed registration just means this device won't get
 * pushes, which the owner app's own polling (useOrders' refetchInterval)
 * covers in the meantime.
 */
export async function syncDeviceRegistration(): Promise<void> {
  const result = await registerForPushNotifications();
  if (!result) return;

  await apiRequest<DeviceToken>("/devices", {
    method: "POST",
    body: { fcmToken: result.token, platform: result.platform, appType: "OWNER" },
  }).catch(() => undefined);
}

/**
 * Best-effort: find this device's own token among the staff's registered
 * devices and deactivate it. Used on logout (use-auth.ts) — if the token
 * can't be re-derived (e.g. no native push config) there's nothing to
 * deactivate and this silently no-ops rather than blocking logout.
 */
export async function deactivateCurrentDevice(): Promise<void> {
  const result = await registerForPushNotifications();
  if (!result) return;

  try {
    const devices = await apiRequest<DeviceToken[]>("/devices");
    const mine = devices.find((d) => d.fcmToken === result.token);
    if (mine) {
      await apiRequest(`/devices/${mine.id}`, { method: "DELETE" });
    }
  } catch {
    // Best-effort cleanup, not a required step of logging out (e.g. a
    // 401 is expected/harmless if the access token already expired by
    // the time this runs) — the caller (useLogout) already treats this
    // whole function as fire-and-forget.
  }
}
