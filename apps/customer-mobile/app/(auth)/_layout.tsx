import { Stack } from "expo-router";
import { colors } from "@/theme/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="mobile-number" options={{ title: "" }} />
      <Stack.Screen name="otp-verify" options={{ title: "" }} />
    </Stack>
  );
}
