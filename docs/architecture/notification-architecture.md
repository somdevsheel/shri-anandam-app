# Notification Architecture

## Provider abstraction (section 39)

```typescript
interface NotificationProvider {
  send(target: DeviceTarget, notification: { title: string; body: string; data?: Record<string, string> }): Promise<void>;
}
```

`PushNotificationProvider` (FCM) is required for V1. `EmailProvider`,
`SMSProvider`, `WhatsAppProvider` share the same shape so the
notification dispatch code (`services/notification-worker`, Phase 8)
never branches on "which channel" beyond picking which provider instance
to call — adding WhatsApp later means writing one new adapter class.

## Push is never the source of truth (section 21)

```
Order created
  → DB transaction (Order + OrderItems + StockReservation + Payment +
    OutboxEvent(OrderCreated))  — COMMIT
  → notification-worker polls outbox_events for PENDING rows
  → Resolves the owner's active DeviceToken rows (possibly several —
    section 22)
  → Sends FCM push to each
  → Marks the OutboxEvent PUBLISHED (or FAILED, incrementing retryCount
    for backoff+retry — never silently dropped)
```

If FCM is down, throttled, or every owner device is offline: the order
still exists in the database with `status = PENDING`. The owner app's
first action on open/foreground is always "fetch pending orders from the
API" — never "trust whatever notifications arrived." A missed push is a
notification-worker retry problem, not a lost order.

## Multiple owner devices (section 22)

`DeviceToken` has no uniqueness constraint tying it to a single owner
identity — `staffId` + `fcmToken` (unique) allows any number of active
tokens per staff member (phone + tablet, old phone not yet logged out,
etc.). The notification worker fans the same push out to every
`isActive = true` token for the target staff/role. Token lifecycle:

- **Registration**: owner app calls a device-registration endpoint on
  login and whenever FCM issues a refreshed token.
- **Invalidation**: a token that FCM reports as `UNREGISTERED` on send is
  marked `isActive = false` (not deleted — kept for audit) rather than
  retried forever.
- **Logout**: explicitly deactivates that device's token so a logged-out
  device stops receiving new-order pushes immediately.

## Deep linking (section 23)

The FCM payload's `data` field carries `{ type: "ORDER", orderId }`, not
a raw deep-link URL string with implicit trust. On tap, the owner app
resolves `orderId` by calling the authenticated `/orders/:id` endpoint —
the backend re-checks that the authenticated staff member's branch
assignment and permissions actually allow viewing that order before
returning it. A crafted or stale `orderId` in a notification payload can
open the order screen but can never bypass the API's own authorization
check.

## Notification channels & priority (Android)

The owner app registers a dedicated high-priority `new_orders` Android
notification channel (`IMPORTANCE_HIGH`, custom sound where policy
permits) at first launch, separate from any lower-priority channel used
for general status/marketing pushes — so a user muting "general updates"
does not accidentally silence new-order alerts.

## Transactional vs. marketing (section 56/section 39)

`Notification.category` is `TRANSACTIONAL` or `MARKETING`. Customer
notification preferences (a future `notification_preferences` table,
added alongside the customer profile screens in Phase 5) can only ever
turn off `MARKETING` notifications — order-status and payment
notifications are always delivered regardless of marketing opt-out,
since they're not promotional.

## Notification record (section 39)

Every attempted notification — regardless of channel — gets one
`Notification` row: `customerId`/`staffId`, `deviceId`, `channel`,
`category`, `type`, `title`, `body`, `entityType`/`entityId` (e.g.
`"Order"`/orderId, so tapping "View" from a notification history list
resolves correctly), `status` (`PENDING` → `SENT`/`FAILED`, then
`DELIVERED`/`READ` if the channel reports those), and timestamps for
each stage. This is what powers both the owner app's "notification
history" screen and any future delivery-rate dashboard.
