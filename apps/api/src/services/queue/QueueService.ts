import { Queue, QueueEvents, Worker } from "bullmq";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { isRedisAvailable, redis } from "../../lib/redis.js";
import { JobProcessor } from "./JobProcessor.js";
import type { QueueJobName, QueueJobPayload, QueueSchedule } from "./types.js";

type ScheduleDefinition = QueueSchedule & {
  payload: QueueJobPayload;
};

export class QueueService {
  private readonly processor = new JobProcessor();
  private queue?: Queue<QueueJobPayload>;
  private queueEvents?: QueueEvents;
  private worker?: Worker<QueueJobPayload>;
  private localInterval?: NodeJS.Timeout;
  private schedules: QueueSchedule[] = [];
  private mode: "redis" | "local" | "disabled" = "disabled";
  private runtimeRole: "api" | "worker" | "all" = env.ATMA_RUNTIME_ROLE;

  private getScheduleDefinitions(): ScheduleDefinition[] {
    const timezone = env.SCHEDULER_TIMEZONE;

    return [
      {
        id: "daily-cycle",
        jobName: "daily-cycle",
        cron: env.SCHEDULE_DAILY_CYCLE_CRON,
        timezone,
        description: "Run the daily treasury cycle on weekdays.",
        active: env.SCHEDULE_DAILY_CYCLE_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring treasury cycle"
        }
      },
      {
        id: "refresh-recent-x-metrics",
        jobName: "refresh-recent-x-metrics",
        cron: env.SCHEDULE_REFRESH_RECENT_X_METRICS_CRON,
        timezone,
        description: "Refresh recent X publication metrics.",
        active: env.SCHEDULE_REFRESH_RECENT_X_METRICS_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring X metrics refresh",
          limit: 5
        }
      },
      {
        id: "generate-platform-content",
        jobName: "generate-platform-content",
        cron: env.SCHEDULE_GENERATE_PLATFORM_CONTENT_CRON,
        timezone,
        description: "Generate platform-specific content packages.",
        active: env.SCHEDULE_GENERATE_PLATFORM_CONTENT_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring content package generation",
          symbol: env.DEFAULT_SYMBOL
        }
      },
      {
        id: "render-weekly-video",
        jobName: "render-weekly-video",
        cron: env.SCHEDULE_RENDER_WEEKLY_VIDEO_CRON,
        timezone,
        description: "Render the weekly summary video.",
        active: env.SCHEDULE_RENDER_WEEKLY_VIDEO_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring weekly video render",
          symbol: env.DEFAULT_SYMBOL
        }
      },
      {
        id: "publish-x-summary",
        jobName: "publish-summary",
        cron: env.SCHEDULE_PUBLISH_X_SUMMARY_CRON,
        timezone,
        description: "Publish the recurring X summary post.",
        active: env.SCHEDULE_PUBLISH_X_SUMMARY_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring X summary publish",
          platform: "x"
        }
      },
      {
        id: "publish-discord-summary",
        jobName: "publish-summary",
        cron: env.SCHEDULE_PUBLISH_DISCORD_SUMMARY_CRON,
        timezone,
        description: "Publish the recurring Discord summary post.",
        active: env.SCHEDULE_PUBLISH_DISCORD_SUMMARY_CRON.length > 0,
        payload: {
          triggeredBy: "scheduler",
          note: "Recurring Discord summary publish",
          platform: "discord"
        }
      }
    ];
  }

  private async syncRecurringSchedules() {
    if (!this.queue) {
      return [];
    }

    const definitions = this.getScheduleDefinitions();
    const existing = await this.queue.getRepeatableJobs();

    for (const job of existing) {
      if (job.id?.startsWith("schedule:")) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    const activeSchedules = definitions.filter((definition) => definition.active);

    for (const schedule of activeSchedules) {
      await this.queue.add(schedule.jobName, schedule.payload, {
        jobId: `schedule:${schedule.id}`,
        repeat: {
          pattern: schedule.cron,
          tz: schedule.timezone
        }
      });
    }

    this.schedules = definitions.map(({ payload: _payload, ...schedule }) => schedule);

    logger.info(
      {
        schedules: this.schedules.map(({ id, jobName, cron, active }) => ({ id, jobName, cron, active }))
      },
      "Recurring schedules synced"
    );

    return this.schedules;
  }

  async init() {
    this.runtimeRole = env.ATMA_RUNTIME_ROLE;

    if (!env.SCHEDULER_ENABLED) {
      this.mode = "disabled";
      this.schedules = [];
      return { mode: this.mode, role: this.runtimeRole };
    }

    const redisUp = await isRedisAvailable();

    if (redisUp) {
      if (this.runtimeRole === "api" || this.runtimeRole === "all") {
        this.queue = new Queue<QueueJobPayload>("atma-jobs", {
          connection: redis
        });
        this.queueEvents = new QueueEvents("atma-jobs", {
          connection: redis
        });
      }

      if (this.runtimeRole === "worker" || this.runtimeRole === "all") {
        this.worker = new Worker<QueueJobPayload>(
          "atma-jobs",
          async (job) => this.processor.process(job.name as QueueJobName, job.data),
          {
            connection: redis
          }
        );

        this.worker.on("completed", (job) => {
          logger.info({ jobId: job.id, name: job.name }, "Queue job completed");
        });

        this.worker.on("failed", (job, error) => {
          logger.error({ jobId: job?.id, name: job?.name, error: error.message }, "Queue job failed");
        });
      }

      if (this.runtimeRole === "api" || this.runtimeRole === "all") {
        await this.syncRecurringSchedules();
      } else {
        this.schedules = this.getScheduleDefinitions().map(({ payload: _payload, ...schedule }) => schedule);
      }
      this.mode = "redis";
      return { mode: this.mode, schedules: this.schedules, role: this.runtimeRole };
    }

    if (this.runtimeRole === "api" || this.runtimeRole === "all") {
      this.localInterval = setInterval(() => {
        void this.processor.process("daily-cycle", {
          triggeredBy: "scheduler",
          note: "Local fallback interval"
        });
      }, env.LOCAL_SCHEDULER_INTERVAL_MS);
    }

    this.schedules = [
      {
        id: "local-daily-cycle",
        jobName: "daily-cycle",
        cron: `every ${env.LOCAL_SCHEDULER_INTERVAL_MS}ms`,
        timezone: env.SCHEDULER_TIMEZONE,
        description: "Local fallback interval for the daily treasury cycle.",
        active: true
      }
    ];
    this.mode = "local";
    return { mode: this.mode, schedules: this.schedules, role: this.runtimeRole };
  }

  async enqueue(jobName: QueueJobName, payload: QueueJobPayload) {
    if (this.mode === "redis" && this.queue) {
      const job = await this.queue.add(jobName, payload);
      return {
        ok: true,
        mode: this.mode,
        jobId: job.id
      };
    }

    if (this.mode === "redis" && !this.queue) {
      return {
        ok: false,
        mode: this.mode,
        message: "Queue producer is not enabled in this runtime role"
      };
    }

    if (this.mode === "local") {
      const result = await this.processor.process(jobName, payload);
      return {
        ok: true,
        mode: this.mode,
        result
      };
    }

    return {
      ok: false,
      mode: this.mode,
      message: "Scheduler disabled"
    };
  }

  getStatus() {
    return {
      enabled: env.SCHEDULER_ENABLED,
      mode: this.mode,
      role: this.runtimeRole,
      localIntervalMs: this.mode === "local" ? env.LOCAL_SCHEDULER_INTERVAL_MS : null,
      schedules: this.schedules
    };
  }

  listSchedules() {
    return this.schedules;
  }

  async syncSchedules() {
    if (this.mode === "redis") {
      return this.syncRecurringSchedules();
    }

    return this.schedules;
  }

  async shutdown() {
    if (this.localInterval) {
      clearInterval(this.localInterval);
    }

    await this.worker?.close();
    await this.queueEvents?.close();
    await this.queue?.close();
  }
}
