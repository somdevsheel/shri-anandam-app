import { Redirect } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

/**
 * The app's entry route — decides splash-time whether to send the user
 * into onboarding/login or straight to the authenticated app. The
 * decision is a redirect, not a conditionally-rendered tree, so
 * expo-router's own history/back-button behavior stays correct (no
 * "back into a screen you were never really on").
 */
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? "/(tabs)/home" : "/onboarding"} />;
}
