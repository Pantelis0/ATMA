import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { queueService } from "./services/queue/queueSingleton.js";

const app = createApp();

await queueService.init();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, role: env.ATMA_RUNTIME_ROLE }, "ATMA API listening");
});

const shutdown = async () => {
  await queueService.shutdown();
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
