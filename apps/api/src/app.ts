import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { healthRouter } from "./routes/health.js";
import { v1Router } from "./routes/v1/index.js";
import { env } from "./config/env.js";

function createCorsMiddleware() {
  const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);
  const allowAllOrigins = env.NODE_ENV !== "production" && allowedOrigins.size === 0;

  if (allowAllOrigins) {
    return cors();
  }

  return cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  });
}

export function createApp() {
  const app = express();

  app.use(createCorsMiddleware());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/health", healthRouter);
  app.use("/v1", v1Router);

  return app;
}
