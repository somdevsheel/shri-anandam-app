import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "@/api/query-client";
import { useAuthStore } from "@/lib/auth-store";
import { ensureAndroidChannel, syncDeviceRegistration } from "@/lib/push-notifications";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors } from "@/theme/theme";

// Foreground notifications still show a heads-up alert (section 20's
// "NEW ORDER" push is exactly the kind of thing a busy kitchen shouldn't
// have to have the app closed to notice).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void ensureAndroidChannel();
  }, []);

  useEffect(() => {
    if (isAuthenticated) void syncDeviceRegistration();
  }, [isAuthenticated]);

  useEffect(() => {
    // section 23: a notification tap deep-links straight to the order
    // it's about, re-fetched (and re-authorized) through the normal
    // GET /orders/:id call — never trusting the notification payload's
    // own content as if it were already-verified order data.
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === "ORDER" && typeof data.orderId === "string") {
        router.push(`/order/${data.orderId}`);
      }
    });
    return () => {
      responseListener.current?.remove();
    };
  }, []);

  if (!isHydrated) {
    return <LoadingView />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order" }} />
          <Stack.Screen name="devices" options={{ headerShown: true, title: "Your devices" }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
