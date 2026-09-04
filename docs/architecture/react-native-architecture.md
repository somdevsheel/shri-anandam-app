# React Native Architecture

## Framework decision: Expo (managed workflow with dev client), not bare RN CLI

**Decision:** both `apps/customer-mobile` and `apps/owner-mobile` are
built on Expo, using a custom **development client** (not Expo Go) and
EAS Build for production binaries.

**Why**, evaluated against the brief's specific native requirements
(section 2/71):

| Requirement | Expo (dev client + EAS) | Bare RN CLI |
|---|---|---|
| FCM push notifications | `expo-notifications` + `@react-native-firebase/messaging` both work in a dev client/prebuild; config plugins handle native FCM setup | Manual native FCM wiring (Android `google-services.json`, notification channel code) |
| Deep links | `expo-linking` + native intent filters via config plugins | Manual `AndroidManifest.xml`/`Info.plist` editing |
| Payment SDKs (Razorpay) | Supported via a config plugin or bare-workflow escape hatch (`expo prebuild`) | Native module linked directly |
| Secure storage | `expo-secure-store` (Keychain/Keystore-backed) | `react-native-keychain` or equivalent |
| Background behavior | Supported via config plugins (background fetch, headless notification handling) | Full manual control |
| Native modules | Any bare RN native module works once `expo prebuild` generates the native projects (this is "Expo bare/dev-client" workflow, not classic managed-only Expo Go) | Native by default |
| Android production build | EAS Build (managed CI, signing config in `eas.json`) or local Gradle build post-`prebuild` | Local/CI Gradle build, signing configured by hand |
| Future iOS | Same `prebuild` + EAS Build pipeline, no separate native project to maintain by hand | Separate Xcode project maintained alongside Android |

The deciding factor: Expo's **dev client + prebuild** workflow gives
every native capability the brief requires (FCM, deep links, payment
SDKs, secure storage, background handling) while keeping the native
Android/iOS project *generated* rather than hand-maintained — fewer
files for two React Native apps to duplicate native configuration
across, faster iteration during Phases 5 and 8, and EAS Build removes
the need to maintain a local Android SDK/Xcode toolchain for CI. This is
not classic "managed Expo Go" (which *would* be the wrong choice here,
since Expo Go can't include custom native modules like a payment SDK) —
it's Expo's build tooling around what is, after `prebuild`, an ordinary
native Android/iOS project.

**Revisit if:** a required native SDK turns out to have no working Expo
config plugin and resists a custom one — at that point `expo prebuild`
already leaves a normal native project to hand-edit, so this is a
non-disruptive escape hatch rather than a migration.

## Project structure (both apps)

```
apps/customer-mobile/
  src/
    app/            # React Navigation screens, grouped by flow
    components/     # Shared presentational components
    features/       # Feature-scoped logic (cart, orders, catalog, auth)
    api/            # @shri-anandam/api-client usage, TanStack Query hooks
    store/          # Zustand — UI-only state, never a copy of server state
    lib/            # Secure storage, deep-link handling, push registration
  app.json / eas.json
```

## Stack (section 71)

- **TypeScript strict mode** — same `tsconfig.base.json` as the rest of
  the monorepo.
- **React Navigation** for routing (native-stack + bottom-tabs).
- **TanStack Query** for all server state (catalog, cart, orders,
  profile) — cached, revalidated, no manual loading-state juggling.
- **Zustand** only for genuine client-only UI state (e.g. "is the filter
  sheet open") — server data is never duplicated into a Zustand store;
  TanStack Query's cache is the single source of truth for anything that
  came from the API.
- **`@shri-anandam/api-client`** (added in Phase 5) — a typed fetch
  wrapper generated/hand-written against the OpenAPI spec the API
  publishes, shared between customer-mobile, owner-mobile, admin-web, and
  kitchen-web so the request/response shapes can't drift between clients.
- **`@shri-anandam/validation`** — the same Zod schemas used server-side
  drive client-side form validation (immediate feedback), while the
  server remains authoritative.

## Offline/cache strategy (section 72)

The catalog (products, categories, images) is cached via TanStack
Query's persistence layer for fast repeat loads and offline browsing.
Cart contents can be drafted locally, but **checkout always
re-validates server-side** — price, availability, and stock are re-read
from the database at order-creation time regardless of what the cached
catalog said, so stale cached data can make browsing feel instant without
ever being trusted for the actual transaction (section 6/72).

## Owner app specifics (section 73)

Push reliability and fast cold-start matter more than feature breadth
here. On login (including after being closed for several days), the
owner app's first network call is always "fetch current pending/active
orders" — it never assumes its local notification history is a complete
or current picture of order state. Deep links resolve through an
authenticated API call (see `docs/architecture/notification-architecture.md`
§ Deep linking), not through trusting notification payload data
directly.

## Mobile security (section 70, expanded)

- Tokens: `expo-secure-store`, never `AsyncStorage`.
- No backend/payment secret keys bundled into the app — only public
  client keys (see `docs/architecture/security-architecture.md`).
- Production builds strip `console.log`/verbose logging via a Babel
  plugin.
- Certificate pinning is evaluated for the production build once a
  payment SDK's own network requirements are confirmed compatible with it
  (some gateway SDKs manage their own TLS trust and conflict with naive
  pinning) — tracked for Phase 12, not blocking earlier phases.
