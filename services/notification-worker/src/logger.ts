import pino from "pino";
import type { Config } from "./config";

/**
 * Structured JSON logging (section 68), same principle as services/api:
 * never log secrets. The FCM service account private key and raw device
 * tokens are the two things this process must never write to a log line.
 */
export function createLogger(config: Config) {
  return pino({
    level: config.LOG_LEVEL,
    redact: { paths: ["fcmToken", "config.FCM_PRIVATE_KEY"], censor: "[REDACTED]" },
  });
}

export type Logger = ReturnType<typeof createLogger>;
