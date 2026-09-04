// Minimal hand-written service worker — no next-pwa/workbox dependency
// (uncertain compatibility with Next.js 16's Turbopack-first build this
// session hasn't verified, and this app's needs are simple enough not
// to warrant it). Two jobs only:
//   1. Be installable — a fetch handler existing at all is what most
//      browsers require before offering "Add to Home Screen"/install.
//   2. Cache-first the build's own hashed static assets (_next/static/*
//      — content-addressed, so cache-first is always safe) for a
//      faster reload and a minimal offline app shell.
// Deliberately does NOT cache navigations, the manifest, or anything
// same-origin dynamic (this app has no same-origin API routes besides
// /api/auth/*, which must never be served stale — a cached "logged in"
// response after a real logout would be a real bug, not a convenience).
// Order data itself is fetched cross-origin, straight to services/api,
// so it was never interceptable by this service worker in the first
// place.

const CACHE_NAME = "sa-kitchen-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  const isOwnStaticAsset = url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
  if (!isOwnStaticAsset || event.request.method !== "GET") {
    return; // let the browser handle everything else normally
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
