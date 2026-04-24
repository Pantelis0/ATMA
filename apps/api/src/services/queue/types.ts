export type QueueJobName =
  | "daily-cycle"
  | "publish-summary"
  | "render-weekly-video"
  | "refresh-x-metrics"
  | "refresh-recent-x-metrics"
  | "generate-platform-content";

export type QueueJobPayload = {
  triggeredBy: "api" | "scheduler" | "worker";
  note?: string;
  platform?: "x" | "discord";
  symbol?: string;
  tweetId?: string;
  publicationTargetId?: string;
  limit?: number;
};

export type QueueSchedule = {
  id: string;
  jobName: QueueJobName;
  cron: string;
  timezone: string;
  description: string;
  active: boolean;
};
