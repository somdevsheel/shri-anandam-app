import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:4000/api/v1";
/** Same origin the REST API lives at, without the /api/v1 path — socket.io connects to the server's root, not a REST route. */
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

/**
 * Phase 11 — live order status updates on the order tracking screen, on
 * top of (not instead of) that screen's own fetch-on-focus. `websocket`-
 * only transport is socket.io's documented recommendation for React
 * Native (no reliable long-polling XHR fallback there, unlike a
 * browser) — see https://socket.io/docs/v4/client-installation/#react-native.
 * Same best-effort design as every other app's realtime hook this
 * phase: a missed event is corrected next time the screen is opened/
 * refetches, never left stale forever.
 */
export function useRealtimeOrders(onOrderUpdated?: () => void) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  // A ref, not a dependency — see apps/kitchen-web's identical pattern
  // (use-realtime.ts) for why: a fresh closure on every render must
  // never tear down and reconnect the socket, only accessToken changing
  // should.
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  useEffect(() => {
    onOrderUpdatedRef.current = onOrderUpdated;
  }, [onOrderUpdated]);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ["websocket"] });

    socket.on("order:updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
      onOrderUpdatedRef.current?.();
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
