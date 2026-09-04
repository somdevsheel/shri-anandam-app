import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

export const redisClientFactory = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    const url = config.getOrThrow<string>("REDIS_URL");
    const client = new Redis(url, { maxRetriesPerRequest: 3 });
    client.on("error", (err) => new Logger("Redis").error(err.message));
    return client;
  },
  inject: [ConfigService],
};

/**
 * Thin convenience wrapper used for OTP storage, rate limiting counters,
 * and idempotency-key locks. Direct ioredis access (REDIS_CLIENT) remains
 * available for anything more specialized (e.g. Redis Streams consumers
 * in services/notification-worker).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get raw(): Redis {
    return this.client;
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  /** Atomic "SET key value NX EX ttl" — used to implement idempotency locks. */
  async setIfNotExists(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, "EX", ttlSeconds, "NX");
    return result === "OK";
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
