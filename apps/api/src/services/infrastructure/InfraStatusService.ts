import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { isRedisAvailable } from "../../lib/redis.js";

export class InfraStatusService {
  async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        configured: Boolean(env.DATABASE_URL),
        reachable: true,
        providerHint: this.getDatabaseProviderHint(env.DATABASE_URL)
      };
    } catch (error) {
      return {
        configured: Boolean(env.DATABASE_URL),
        reachable: false,
        providerHint: this.getDatabaseProviderHint(env.DATABASE_URL),
        error: error instanceof Error ? error.message : "Unknown database error"
      };
    }
  }

  async checkRedis() {
    const reachable = await isRedisAvailable();

    return {
      configured: Boolean(env.REDIS_URL),
      reachable,
      providerHint: this.getRedisProviderHint(env.REDIS_URL),
      error: reachable ? undefined : "Redis is not reachable with the current REDIS_URL"
    };
  }

  async getStatus() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      ok: database.reachable && redis.reachable,
      database,
      redis,
      env: {
        databaseUrlPresent: Boolean(env.DATABASE_URL),
        redisUrlPresent: Boolean(env.REDIS_URL)
      }
    };
  }

  private getDatabaseProviderHint(url: string) {
    if (url.includes("prisma.io")) return "Prisma Postgres";
    if (url.includes("supabase.co")) return "Supabase";
    if (url.includes("railway.app") || url.includes("railway.internal")) return "Railway";
    if (url.includes("render.com")) return "Render";
    if (url.includes("localhost")) return "Local Postgres";
    return "Unknown";
  }

  private getRedisProviderHint(url: string) {
    if (url.includes("upstash.io")) return "Upstash";
    if (url.includes("redislabs.com") || url.includes("redis-cloud.com")) return "Redis Cloud";
    if (url.includes("railway.app") || url.includes("railway.internal")) return "Railway";
    if (url.includes("localhost")) return "Local Redis";
    return "Unknown";
  }
}
