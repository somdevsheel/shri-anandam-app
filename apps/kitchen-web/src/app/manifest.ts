import type { MetadataRoute } from "next";

/**
 * What makes this app a PWA rather than just a responsive site: a
 * manifest (this file, native Next.js support — see node_modules/next/
 * dist/docs' manifest.md) plus a registered service worker
 * (src/components/ServiceWorkerRegistration.tsx + public/sw.js) for
 * installability and an offline app shell. Real-time order updates
 * (the eventual "WebSocket" transport docs/architecture/production-
 * architecture.md names for this app) are Phase 11's work — this ships
 * with the same polling approach as owner-mobile/admin-web until then.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shri Anandam Kitchen",
    short_name: "SA Kitchen",
    description: "Kitchen order queue for Shri Anandam Sweets & Restaurant staff.",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#fff8f0",
    theme_color: "#b3541e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
