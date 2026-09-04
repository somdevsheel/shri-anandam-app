import * as Sentry from "@sentry/node";

/**
 * Called first thing in main.ts, before NestFactory.create() — Sentry's
 * own guidance is to initialize as early as possible so its instrumentation
 * can hook Node's built-ins before anything else touches them.
 *
 * A no-op when SENTRY_DSN is unset (every environment this repo can
 * actually run in right now — no Sentry project has been provisioned,
 * same honest-limitation pattern as Razorpay/FCM in earlier phases):
 * `Sentry.init()` with an empty dsn does not throw, and every
 * `Sentry.captureException()` call downstream becomes a harmless no-op
 * rather than a startup failure or a runtime error.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Errors only for now, not performance tracing (tracesSampleRate
    // unset) — this repo has no Sentry project to tune a real sample
    // rate against yet; adding APM tracing later is a config change
    // here, not a code change.
  });
}

export { Sentry };
