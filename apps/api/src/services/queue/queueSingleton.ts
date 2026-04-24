import { QueueService } from "./QueueService.js";

declare global {
  // eslint-disable-next-line no-var
  var __atmaQueueService: QueueService | undefined;
}

export const queueService = globalThis.__atmaQueueService ?? new QueueService();

if (process.env.NODE_ENV !== "production") {
  globalThis.__atmaQueueService = queueService;
}

