import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { ServerOptions } from "socket.io";
import Redis from "ioredis";

/**
 * services/api is documented (docs/architecture/production-architecture.md
 * "Statelessness", section 66) to run N stateless replicas behind a load
 * balancer — a plain in-process socket.io server would only broadcast to
 * clients connected to the SAME replica that handled the triggering
 * request, silently missing every client connected to any other replica.
 * The Redis adapter fixes this via pub/sub fan-out, using the same
 * REDIS_URL already a hard dependency for cache/OTP/rate-limiting
 * (ADR-008) — no new infrastructure for this.
 *
 * Two dedicated ioredis connections (`.duplicate()` of a throwaway base
 * client, matching the standard ioredis pub/sub pattern): a connection
 * placed into subscribe mode can't issue any other command, so the
 * publisher and subscriber must be separate connections regardless of
 * how many logical channels are used.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    const pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    const subClient = pubClient.duplicate();
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
