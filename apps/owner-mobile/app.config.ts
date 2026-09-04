import type { ExpoConfig } from "expo/config";

/**
 * Dynamic config, same rationale as apps/customer-mobile/app.config.ts —
 * the API base URL comes from env vars per EAS build profile, never
 * hardcoded into the binary.
 */
const config: ExpoConfig = {
  name: "Shri Anandam Owner",
  slug: "shri-anandam-owner",
  scheme: "shrianandamowner",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.shrianandam.owner",
  },
  android: {
    package: "com.shrianandam.owner",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#2B2320",
    },
    // A notification tap deep-links straight to the order it's about
    // (section 23) — the notification payload's data.orderId drives the
    // in-app navigation (src/lib/push-notifications.ts), this intent
    // filter is for a plain https link (e.g. shared from admin-web)
    // opening the same screen.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "shrianandam.com", pathPrefix: "/owner" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    // Firebase Cloud Messaging (section 22) needs google-services.json —
    // not present in this repo (no real Firebase project provisioned,
    // same honest limitation as services/notification-worker's FCM_*
    // env vars being empty). Wire this in when a real project exists:
    // googleServicesFile: "./google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#2B2320",
      },
    ],
    [
      "expo-notifications",
      {
        // Matches notification-templates.ts's ORDER_CHANNEL_ID so a
        // build-time-declared channel exists before the first push
        // arrives, not just the one created at runtime in _layout.tsx.
        icon: "./assets/icon.png",
        color: "#B3541E",
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
    eas: {
      // Linked via `eas init` to @iamsosomm/shri-anandam-owner
      // (https://expo.dev/accounts/iamsosomm/projects/shri-anandam-owner)
      // — not a secret, safe to commit; EAS_PROJECT_ID can still override
      // for a different Expo account/project.
      projectId: process.env.EAS_PROJECT_ID ?? "3639387f-3071-44ff-90a1-4f2eb4a306a5",
    },
  },
};

export default config;
