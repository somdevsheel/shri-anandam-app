import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { Logger } from "@nestjs/common";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
  // stay unprefixed at /health, /live, /ready (section 46) since
  // orchestrators and load balancers expect fixed, unversioned paths.
  app.setGlobalPrefix(config.get<string>("API_PREFIX", "api/v1"), {
    exclude: ["health", "live", "ready"],
  });
  app.enableShutdownHooks();

  const port = config.get<number>("APP_PORT", 4000);
  await app.listen(port);

  new Logger("Bootstrap").log(`Shri Anandam API listening on port ${port}`);
}

bootstrap();
