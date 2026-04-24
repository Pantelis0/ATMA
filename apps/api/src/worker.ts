import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { queueService } from "./services/queue/queueSingleton.js";

const status = await queueService.init();
logger.info({ status, role: env.ATMA_RUNTIME_ROLE }, "ATMA worker initialized");

process.on("SIGINT", async () => {
  await queueService.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await queueService.shutdown();
  process.exit(0);
});
