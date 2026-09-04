export interface PushNotification {
  title: string;
  body: string;
  /** Delivered as the FCM `data` payload — used for deep linking (section 23), never trusted as an authorization decision on its own by the receiving app. */
  data: Record<string, string>;
  /** Android notification channel id (section 20's "distinct high-priority order notification channel"). */
  androidChannelId?: string;
}

export type SendResult =
  | { status: "sent" }
  | { status: "failed"; retryable: boolean; deactivateToken: boolean };

/**
 * Mirrors the PaymentProvider abstraction pattern (Phase 7): the outbox
 * processor depends only on this interface, never on firebase-admin
 * directly, so adding APNs-direct, WhatsApp, or SMS as parallel channels
 * (section 39) is a new provider, not a rewrite.
 */
export interface NotificationProvider {
  send(fcmToken: string, notification: PushNotification): Promise<SendResult>;
}
