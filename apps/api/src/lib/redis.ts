import { Redis } from "ioredis";
import { env } from "../config/env.js";

declare global {
  // eslint-disable-next-line no-var
  var __atmaRedis: Redis | undefined;
}

export const redis =
  globalThis.__atmaRedis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 500,
    retryStrategy: () => null
  });

redis.on("error", () => {
  // QueueService handles Redis availability explicitly.
});

if (process.env.NODE_ENV !== "production") {
  globalThis.__atmaRedis = redis;
}

export async function isRedisAvailable() {
  try {
    await redis.connect();
  } catch {
    // ignore connect errors, ping will fail below
  }

  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
