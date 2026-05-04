import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
dotenv.config({
  path: resolve(envRoot, ".env")
});

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ATMA_RUNTIME_ROLE: z.enum(["api", "worker", "all"]).default("all"),
  LOG_LEVEL: z.string().default("info"),
  ATMA_ENTITY_NAME: z.string().default("ATMA Labs"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/atma"),
  DIRECT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SCHEDULER_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  LOCAL_SCHEDULER_INTERVAL_MS: z.coerce.number().default(3600000),
  SCHEDULER_TIMEZONE: z.string().default("Europe/Athens"),
  SCHEDULE_DAILY_CYCLE_CRON: z.string().default("0 10 * * 1-5"),
  SCHEDULE_REFRESH_RECENT_X_METRICS_CRON: z.string().default("*/30 * * * *"),
  SCHEDULE_GENERATE_PLATFORM_CONTENT_CRON: z.string().default("0 8 * * 1-5"),
  SCHEDULE_RENDER_WEEKLY_VIDEO_CRON: z.string().default("0 18 * * 5"),
  SCHEDULE_PUBLISH_X_SUMMARY_CRON: z.string().default(""),
  SCHEDULE_PUBLISH_DISCORD_SUMMARY_CRON: z.string().default(""),
  MEDIA_OUTPUT_DIR: z.string().default("./generated/media"),
  FFMPEG_PATH: z.string().optional(),
  VIDEO_FONT_PATH: z.string().optional(),
  VIDEO_WIDTH: z.coerce.number().default(1080),
  VIDEO_HEIGHT: z.coerce.number().default(1920),
  VIDEO_SCENE_DURATION_SEC: z.coerce.number().default(4),
  VIDEO_DEFAULT_MUSIC_PATH: z.string().optional(),
  VIDEO_DEFAULT_VOICEOVER_PATH: z.string().optional(),
  VIDEO_MUSIC_VOLUME: z.coerce.number().default(0.18),
  VIDEO_VOICEOVER_VOLUME: z.coerce.number().default(1),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    ),
  PAPER_TRADING: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  DEFAULT_SYMBOL: z.string().default("VT"),
  MAX_POSITION_SIZE_PCT: z.coerce.number().default(0.1),
  MAX_DAILY_LOSS_PCT: z.coerce.number().default(0.02),
  MAX_DRAWDOWN_PCT: z.coerce.number().default(0.1),
  ALPACA_API_KEY: z.string().optional(),
  ALPACA_SECRET_KEY: z.string().optional(),
  ALPACA_BASE_URL: z.string().default("https://paper-api.alpaca.markets"),
  X_CONSUMER_KEY: z.string().optional(),
  X_CONSUMER_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional()
});

export const env = envSchema.parse(process.env);
