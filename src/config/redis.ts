import Redis from "ioredis";
import { config } from "./env";
import { log } from "../utils/logger";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedis(): Redis {
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) {
        log.error("Redis max retries exceeded");
        return null;
      }
      return Math.min(times * 200, 2000);
    },
  });

  client.on("error", (err: Error) => {
    log.error("Redis connection error", { message: err.message });
  });

  client.on("connect", () => {
    log.info("Redis connected");
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (config.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  log.info("Redis connection closed");
}

export const redisHelpers = {
  async get(key: string): Promise<string | null> {
    return redis.get(key);
  },
  async set(key: string, value: string): Promise<void> {
    await redis.set(key, value);
  },
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await redis.setex(key, seconds, value);
  },
  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await redis.del(...keys);
  },
  async exists(key: string): Promise<boolean> {
    const n = await redis.exists(key);
    return n === 1;
  },
};

/** Dedicated Redis connection for BullMQ (blocking commands). */
export function createBullRedis(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
