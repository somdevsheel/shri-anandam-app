import { initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import type { Config } from "../config";
import type { Logger } from "../logger";
import type { NotificationProvider, PushNotification, SendResult } from "./notification-provider.interface";

/** FCM error codes that mean "this token will never work again" — section 22's "token invalidation". */
const DEAD_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

/**
 * Real Firebase Admin SDK integration. Requires FCM_PROJECT_ID/
 * FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY (a service account) — see
 * .env.example. Without real Firebase credentials this class cannot be
 * exercised end-to-end in this repo (no Firebase project provisioned
 * here); send() fails closed with a clear, retryable error rather than
 * silently pretending to succeed — see the constructor guard and
 * fcm-notification.provider.spec.ts for what IS tested without one
 * (error classification logic, a pure function).
 */
export class FcmNotificationProvider implements NotificationProvider {
  private readonly messaging: Messaging | null;

  constructor(config: Config, private readonly logger: Logger) {
    if (!config.FCM_PROJECT_ID || !config.FCM_CLIENT_EMAIL || !config.FCM_PRIVATE_KEY) {
      this.logger.warn("FCM credentials not configured — push notifications will fail closed (DB rows are still written; section 21's 'DB is the source of truth' holds regardless)");
      this.messaging = null;
      return;
    }

    const app: App = initializeApp({
      credential: cert({
        projectId: config.FCM_PROJECT_ID,
        clientEmail: config.FCM_CLIENT_EMAIL,
        // .env stores literal "\n" sequences for a multi-line PEM key;
        // real newlines are required for the SDK to parse it.
        privateKey: config.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    this.messaging = getMessaging(app);
  }

  async send(fcmToken: string, notification: PushNotification): Promise<SendResult> {
    if (!this.messaging) {
      return { status: "failed", retryable: true, deactivateToken: false };
    }

    try {
      await this.messaging.send({
        token: fcmToken,
        notification: { title: notification.title, body: notification.body },
        data: notification.data,
        android: {
          priority: "high",
          notification: notification.androidChannelId ? { channelId: notification.androidChannelId } : undefined,
        },
        apns: { payload: { aps: { sound: "default" } } },
      });
      return { status: "sent" };
    } catch (err) {
      const code = (err as { code?: string } | undefined)?.code;
      return { status: "failed", ...classifyFcmErrorCode(code) };
    }
  }
}

/** Extracted as a pure function so the classification logic (the only non-network part of this class) is unit-testable without real Firebase credentials. */
export function classifyFcmErrorCode(code: string | undefined): { retryable: boolean; deactivateToken: boolean } {
  if (code && DEAD_TOKEN_CODES.has(code)) {
    return { retryable: false, deactivateToken: true };
  }
  return { retryable: true, deactivateToken: false };
}
