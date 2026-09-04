import { useEffect, useRef } from "react";

/**
 * Phase 11 update: this used to poll-diff the queue for a newly
 * appeared PENDING order id (see git history) — now the WebSocket
 * layer's `order:created` event (src/lib/hooks/use-realtime.ts) tells
 * this exactly when to play, so all this hook does is own the <audio>
 * element and expose `play()`.
 *
 * Browsers block autoplaying audio until a user gesture happens on the
 * page (staff signing in counts) — `.catch()` swallows that rejection
 * rather than surfacing it as an error, since a kitchen screen left
 * open all shift will have long since had that gesture.
 */
export function useNewOrderAlert(): () => void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/sounds/new-order.wav");
  }, []);

  return () => {
    audioRef.current?.play().catch(() => undefined);
  };
}
