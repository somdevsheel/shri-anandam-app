import "reflect-metadata";
import { initSentry } from "./sentry";

// Before any other import touches Node's built-ins (Sentry's own
// guidance — see sentry.ts's comment for why this stays a no-op in
// every environment this repo can currently run in).
initSentry();

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { Logger } from "@nestjs/common";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./realtime/redis-io.adapter";

async function bootstrap() {
  // rawBody: true makes Nest's body parser stash the unparsed request
  // bytes on `req.rawBody` alongside the normal parsed `req.body` — the
  // Razorpay webhook handler needs those exact bytes to verify the HMAC
  // signature (parsing and re-serializing JSON is not guaranteed to
  // reproduce byte-identical output, which would break verification).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("CORS_ALLOWED_ORIGINS", "").split(",").filter(Boolean),
    credentials: true,
  });

  // e.g. API_PREFIX="api/v1" -> every route is served under /api/v1/...
  // (section 41). Version bumps (v2) happen by changing this prefix per
  // deployment rather than per-route versioning, matching the flat
  // /api/v1/<domain> structure used throughout the brief. Health probes
  // and the Prometheus scrape endpoint stay unprefixed (section 46) —
  // orchestrators/scrapers expect fixed, unversioned paths.
  app.setGlobalPrefix(config.get<string>("API_PREFIX", "api/v1"), {
    exclude: ["health", "live", "ready", "metrics"],
  });
  app.enableShutdownHooks();

  // Phase 11 — Redis pub/sub fan-out so a WebSocket broadcast reaches
  // clients connected to any replica, not just the one that handled the
  // triggering request (see realtime/redis-io.adapter.ts).
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(config.getOrThrow<string>("REDIS_URL"));
  app.useWebSocketAdapter(redisIoAdapter);

  const port = config.get<number>("APP_PORT", 4000);
  await app.listen(port);

  new Logger("Bootstrap").log(`Shri Anandam API listening on port ${port}`);
}

bootstrap();
