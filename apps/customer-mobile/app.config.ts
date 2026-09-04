import type { ExpoConfig } from "expo/config";

/**
 * Dynamic config (not static app.json) so the API base URL and other
 * environment-specific values come from env vars per build profile
 * (see eas.json) instead of being hardcoded — the same "never bake
 * environment config into the binary" rule the backend follows via
 * .env (docs/architecture/deployment-architecture.md).
 */
const config: ExpoConfig = {
  name: "Shri Anandam",
  slug: "shri-anandam-customer",
  scheme: "shrianandam",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.shrianandam.customer",
  },
  android: {
    package: "com.shrianandam.customer",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFF8F0",
    },
    // Deep links from owner-app-style flows (order tracking links, share
    // links) — see docs/architecture/notification-architecture.md for
    // the secure deep-link handling rule this app follows: a deep link
    // opens a screen, it never bypasses the API's own authorization
    // check on the data that screen then fetches.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "shrianandam.com", pathPrefix: "/app" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    // SDK 51+ moved splash-screen config off the top-level `splash` key
    // (removed in SDK 57) and onto this plugin's own options.
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#FFF8F0",
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
    eas: {
      // Linked via `eas init` to @iamsosomm/shri-anandam-customer
      // (https://expo.dev/accounts/iamsosomm/projects/shri-anandam-customer)
      // — not a secret, safe to commit; EAS_PROJECT_ID can still override
      // for a different Expo account/project.
      projectId: process.env.EAS_PROJECT_ID ?? "7429b252-058d-4e12-8bd8-542a4c26c423",
    },
  },
};

export default config;
