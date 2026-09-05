/**
 * `crypto.randomUUID()` doesn't exist in this app's JS runtime (Hermes,
 * via React Native — no `crypto` global, no `expo-crypto`/polyfill
 * installed). Calling it crashed the app the instant Checkout mounted
 * (its `useState(() => crypto.randomUUID())` initializer runs on first
 * render), verified live via `grep` over node_modules turning up no
 * `crypto` polyfill anywhere in this tree.
 *
 * A Math.random()-based v4 UUID is fine here: this only backs the
 * checkout idempotency key (services/api dedupes retries of the SAME
 * attempt by this string), not anything security-sensitive — a
 * predictable value would just mean a false idempotency match, which
 * would need an attacker to guess another customer's exact in-flight
 * key, not a real exposure worth pulling in a native crypto module for.
 */
export function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
