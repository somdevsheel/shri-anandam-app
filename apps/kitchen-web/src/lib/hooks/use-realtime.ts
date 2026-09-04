import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";

/** Same origin the REST API lives at, without the /api/v1 path — socket.io connects to the server's root, not a REST route. */
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "");

interface NewOrderPayload {
  id: string;
  orderNumber: string;
}

/**
 * Phase 11 — the queue now updates the instant `order:created`/
 * `order:updated` arrives (this is what plays the new-order sound now,
 * not the poll-diff apps/kitchen-web shipped with in Phase 10 — see the
 * git history of use-new-order-alert.ts) rather than waiting for the
 * next 5-second poll tick. The poll itself (use-orders.ts) is
 * deliberately kept, at the same interval, as a fallback safety net —
 * every screen in this repo that has ever added a push/realtime layer
 * (FCM in Phase 8, this) has kept its REST fetch/poll as the actual
 * source of truth per the same principle: a missed WebSocket event
 * because of a brief disconnect is corrected by the next poll tick,
 * never left stale until reconnect.
 *
 * `onOrderCreated` is a ref, not a dependency, so passing a fresh
 * closure on every render (the common case) never tears down and
 * reconnects the socket — only `accessToken` changing does that.
 */
export function useRealtimeOrders(onOrderCreated?: (order: NewOrderPayload) => void) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const onOrderCreatedRef = useRef(onOrderCreated);
  useEffect(() => {
    onOrderCreatedRef.current = onOrderCreated;
  }, [onOrderCreated]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket"] });

    socket.on("order:created", (order: NewOrderPayload) => {
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
      onOrderCreatedRef.current?.(order);
    });
    socket.on("order:updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
      // Broad, not keyed to one order id — cheap no-op for whichever
      // order-detail screen (if any) isn't currently mounted, and
      // correctly refreshes the one that is without this hook needing
      // to know which specific order id is open.
      void queryClient.invalidateQueries({ queryKey: ["order"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
