import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { NotificationDb } from "./db";
import { FcmNotificationProvider } from "./providers/fcm-notification.provider";
import { OutboxProcessor } from "./outbox-processor";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);
  logger.info({ pollIntervalMs: config.POLL_INTERVAL_MS }, "Starting notification-worker");

  const db = new NotificationDb(config.DATABASE_URL);
  await db.ping();
  logger.info("Database connection established");

  const provider = new FcmNotificationProvider(config, logger);
  const processor = new OutboxProcessor(db, provider, logger);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down notification-worker");
    await db.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // A plain poll loop, not LISTEN/NOTIFY or a message broker — the
  // deliberately simple choice for V1 (docs/architecture/notification-architecture.md);
  // outbox_events is small and this worker is stateless, so a missed
  // poll or a restart never loses anything, it just picks up PENDING
  // rows on the next tick.
  while (!shuttingDown) {
    try {
      const processed = await processor.processBatch(config.OUTBOX_BATCH_SIZE);
      if (processed > 0) {
        logger.info({ processed }, "Processed outbox events");
      }
    } catch (err) {
      logger.error({ err }, "Poll loop iteration failed — will retry next tick");
    }
    await sleep(config.POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- logger may not be constructed yet if config loading itself failed
  console.error("Fatal error starting notification-worker:", err);
  process.exit(1);
});
