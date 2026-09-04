"use client";

import { useEffect } from "react";

/** Registers public/sw.js — see that file's comment for exactly what it does and (deliberately) doesn't cache. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal — the app works identically without it, just without
      // installability/the static-asset cache. Common in dev over
      // plain HTTP on some browsers' stricter secure-context rules.
    });
  }, []);

  return null;
}
