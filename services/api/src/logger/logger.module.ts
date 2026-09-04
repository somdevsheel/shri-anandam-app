import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import type { RequestWithId } from "../common/middleware/request-id.middleware";

/**
 * Structured JSON logging (section 68). Every log line carries requestId,
 * method, url, status, and response time. Sensitive fields — OTPs,
 * passwords, tokens, refresh tokens, and Authorization headers — are
 * redacted, never logged, even at debug level.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL", "info"),
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.body.otp",
              "req.body.password",
              "req.body.refreshToken",
              "req.body.accessToken",
              "res.headers['set-cookie']",
            ],
            censor: "[REDACTED]",
          },
          customProps: (req) => ({ requestId: (req as RequestWithId).requestId }),
          autoLogging: true,
          transport:
            config.get<string>("NODE_ENV") === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
