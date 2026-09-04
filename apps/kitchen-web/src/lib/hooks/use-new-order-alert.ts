import { useEffect, useRef } from "react";
import { OrderStatus } from "@shri-anandam/shared-types";
import type { Order } from "@/lib/types";

/**
 * Plays public/sounds/new-order.wav the moment a PENDING order id
 * appears that wasn't in the previous poll's result — the actual
 * "someone needs to look at the queue now" signal this screen exists
 * to provide while Phase 11's WebSocket push doesn't yet exist.
 *
 * Browsers block autoplaying audio until a user gesture happens on the
 * page (staff signing in counts) — `.catch()` below swallows that
 * rejection rather than surfacing it as an error, since a kitchen
 * screen left open all shift will have long since had that gesture.
 */
export function useNewOrderAlert(orders: Order[] | undefined) {
  const seenPendingIds = useRef<Set<string> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/new-order.wav");
  }, []);

  useEffect(() => {
    if (!orders) return;
    const currentPendingIds = new Set(orders.filter((o) => o.status === OrderStatus.PENDING).map((o) => o.id));

    if (seenPendingIds.current === null) {
      // First load — these are pre-existing pending orders, not new
      // arrivals; don't alert for a screen that just opened.
      seenPendingIds.current = currentPendingIds;
      return;
    }

    const hasNewArrival = [...currentPendingIds].some((id) => !seenPendingIds.current!.has(id));
    if (hasNewArrival) {
      audioRef.current?.play().catch(() => undefined);
    }
    seenPendingIds.current = currentPendingIds;
  }, [orders]);
}
