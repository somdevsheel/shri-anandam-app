import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "@/api/query-client";
import { useAuthStore } from "@/lib/auth-store";
import { LoadingView } from "@/components/ui/LoadingView";
import { colors } from "@/theme/theme";

export default function RootLayout() {
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    // Reads whatever's in SecureStore once at startup — see auth-store.ts.
    // Everything downstream (app/index.tsx's redirect, the API client)
    // waits on this rather than assuming a logged-out state while it's
    // still in flight.
    void useAuthStore.getState().hydrate();
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
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="product/[slug]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="checkout" options={{ headerShown: true, title: "Checkout" }} />
          <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order" }} />
          <Stack.Screen name="category/[slug]" options={{ headerShown: true }} />
          <Stack.Screen name="addresses/index" options={{ headerShown: true, title: "Your addresses" }} />
          <Stack.Screen
            name="addresses/new"
            options={{ headerShown: true, title: "Add address", presentation: "modal" }}
          />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
