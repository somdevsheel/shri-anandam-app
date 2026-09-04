import { useEffect } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";

/** Same origin the REST API lives at, without the /api/v1 path — socket.io connects to the server's root, not a REST route. */
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "");

/**
 * Phase 11 — live order updates for the Orders list/detail screens,
 * on top of (not instead of) their existing poll. Same design as
 * apps/kitchen-web's use-realtime.ts: a missed event from a brief
 * disconnect is corrected by the next poll tick, so this is an
 * enhancement to responsiveness, not the source of truth.
 */
export function useRealtimeOrders() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket"] });

    const invalidateAll = () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
    };
    socket.on("order:created", invalidateAll);
    socket.on("order:updated", invalidateAll);

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
