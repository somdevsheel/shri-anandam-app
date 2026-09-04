# Security Architecture

## Authentication

| Subject | Method | Notes |
|---|---|---|
| Customer | Mobile OTP | No password — section 32. OTP hashed (SHA-256) at rest in Redis, TTL-bound, max-attempt-bound. |
| Staff/Admin | Email + password | Argon2id hashing (ADR-003). MFA-ready: `Staff.mfaEnabled`/`mfaSecret` columns exist now; TOTP verification step is added when MFA ships without a schema change. |

Both issue the same JWT access token (15 min default TTL) + rotating
opaque refresh token (30 day default TTL, hashed at rest, single-use —
see `TokenService.rotateRefreshToken`). Refresh token reuse (presenting
an already-rotated token) revokes the entire session family and logs a
`SecurityEvent`, treating it as probable token theft.

## Authorization — RBAC enforced server-side (section 34)

`PermissionsGuard` is a **global** Nest guard — every route is
permission-checked unless it opts out. A route declares
`@RequirePermissions(Permission.ORDER_REFUND)`; the guard rejects any
request whose authenticated principal is a customer, or staff lacking
that exact permission, with 403 before the controller method body ever
runs. There is no code path where the frontend hiding a button is what
prevents the action — every admin/kitchen mutation is independently
enforced here.

## Secrets (section 44)

Nothing under version control ever contains a real secret.
`.env.example` ships placeholder-only values; `.env` is gitignored.
`ConfigModule.forRoot({ validate })` (see
`services/api/src/config/configuration.ts`) makes the process refuse to
boot if a required secret (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`DATABASE_URL`, `REDIS_URL`) is missing or too short — a
misconfigured deploy fails at startup, not silently at the first request
that needs the secret.

## Input validation (section 43)

Every mutating endpoint validates its body against a Zod schema from
`packages/validation` via `ZodValidationPipe` before the controller
method runs; invalid input never reaches domain code. The same schemas
run client-side for immediate form feedback, but the server-side check is
authoritative — the client's validation passing proves nothing to the
API.

## Rate limiting (section 69)

Global default (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_TTL_SECONDS`,
default 100/min) via `ThrottlerGuard`, registered globally in
`AppModule`. Sensitive endpoints override it with stricter per-route
limits (`@Throttle`):

- OTP request: 3/min per IP
- OTP verify: 5/min per IP
- Staff login: 5/min per IP
- Token refresh: 10/min per IP

This is on top of, not instead of, `OtpService`'s own per-mobile-number
resend cooldown and max-attempt counter (both Redis-backed) — the
Throttler limits are per-IP/global, the OTP service's limits are
per-identifier, and both apply simultaneously.

## Transport & headers

`helmet()` is applied globally in `main.ts` (sensible defaults: HSTS,
`X-Content-Type-Options`, disabled `X-Powered-By`, etc.). CORS is
allow-listed by `CORS_ALLOWED_ORIGINS`, not `*`. HTTPS termination
happens at the load balancer/Nginx layer in every non-local environment;
local dev is plain HTTP against `localhost` only.

## SQL injection / XSS

Prisma's generated client parameterizes every query — there is no raw
string-concatenated SQL anywhere in the codebase; the one place raw SQL
appears (`$queryRaw` SELECT 1 in the health check) takes no user input.
API responses are JSON, not server-rendered HTML, so reflected-XSS via
the API itself isn't a vector; the Next.js admin/kitchen apps rely on
React's default output escaping and avoid `dangerouslySetInnerHTML`
except where explicitly reviewed.

## Audit logging (section 45)

`AuditLog` records `actorId`, `actorType`, `action`, `entityType`,
`entityId`, `oldValue`/`newValue` (JSON diffs — the one place JSON is
appropriate, per the database rules), `ipAddress`, `userAgent`,
`createdAt`. Written for every sensitive administrative action as those
modules ship: price changes, refunds, order cancellations, inventory
adjustments, staff permission changes, coupon creation, product
deletion, and manual payment collection.

## What is never logged (section 68)

The Pino logger's `redact` config
(`services/api/src/logger/logger.module.ts`) strips
`Authorization`/`Cookie` headers and `otp`/`password`/`refreshToken`/
`accessToken` body fields from every log line, at every log level,
including `debug` — this is a redaction list checked in code, not a
convention developers have to remember per log call.

## Mobile security (section 70)

React Native apps: JWT/refresh tokens go in platform secure storage
(Keychain on iOS, Keystore-backed encrypted storage on Android), never
`AsyncStorage` in plaintext. No backend secret, payment gateway secret
key, or service-account credential is ever bundled into the mobile app —
only public/publishable keys (e.g. Razorpay's client key ID) ship
client-side. Production builds disable verbose console logging.
