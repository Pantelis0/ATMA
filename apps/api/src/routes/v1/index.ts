import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { ContentPlanner } from "../../services/content/ContentPlanner.js";
import { RiskGuard } from "../../services/governance/RiskGuard.js";
import { InfraStatusService } from "../../services/infrastructure/InfraStatusService.js";
import { PersistenceService } from "../../services/persistence/PersistenceService.js";
import { DiscordWebhookPublisher } from "../../services/publishing/DiscordWebhookPublisher.js";
import { XPublisher } from "../../services/publishing/XPublisher.js";
import { queueService } from "../../services/queue/queueSingleton.js";
import { VideoRenderService } from "../../services/render/VideoRenderService.js";
import { XAnalyticsService } from "../../services/analytics/XAnalyticsService.js";
import { AlpacaTradingClient } from "../../services/trading/AlpacaTradingClient.js";
import { StrategyService } from "../../services/strategy/StrategyService.js";
import { PaperBroker } from "../../services/trading/PaperBroker.js";

export const v1Router = Router();

const portfolioSnapshot = {
  equity: 10000,
  cash: 1500,
  dailyPnlPct: -0.003,
  drawdownPct: -0.012,
  openPositions: [{ symbol: env.DEFAULT_SYMBOL, marketValue: 900, weightPct: 0.09 }]
};

const riskGuard = new RiskGuard({
  maxPositionSizePct: env.MAX_POSITION_SIZE_PCT,
  maxDailyLossPct: env.MAX_DAILY_LOSS_PCT,
  maxDrawdownPct: env.MAX_DRAWDOWN_PCT
});

const strategyService = new StrategyService();
const paperBroker = new PaperBroker();
const persistenceService = new PersistenceService();
const infraStatusService = new InfraStatusService();
const videoRenderService = new VideoRenderService();
const xAnalyticsService = new XAnalyticsService(env.X_BEARER_TOKEN);
const alpacaTradingClient = new AlpacaTradingClient(
  env.ALPACA_API_KEY,
  env.ALPACA_SECRET_KEY,
  env.ALPACA_BASE_URL
);
const contentPlanner = new ContentPlanner();
const discordPublisher = new DiscordWebhookPublisher(env.DISCORD_WEBHOOK_URL);
const xPublisher = new XPublisher(
  env.X_CONSUMER_KEY,
  env.X_CONSUMER_SECRET,
  env.X_ACCESS_TOKEN,
  env.X_ACCESS_TOKEN_SECRET
);

const postMetricSchema = z.object({
  impressions: z.number().int().nonnegative().optional(),
  engagements: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  followersDelta: z.number().int().optional(),
  revenueAttributed: z.number().nonnegative().optional()
});

const enqueueSchema = z.object({
  note: z.string().optional(),
  platform: z.enum(["x", "discord"]).optional(),
  symbol: z.string().optional(),
  tweetId: z.string().optional(),
  publicationTargetId: z.string().optional(),
  limit: z.number().int().positive().max(100).optional()
});

const renderVideoSchema = z.object({
  symbol: z.string().optional(),
  title: z.string().optional(),
  cta: z.string().optional(),
  musicPath: z.string().optional(),
  voiceoverPath: z.string().optional(),
  musicVolume: z.number().nonnegative().max(2).optional(),
  voiceoverVolume: z.number().nonnegative().max(2).optional(),
  scenes: z
    .array(
      z.object({
        title: z.string(),
        body: z.string()
      })
    )
    .min(1)
    .optional()
});

v1Router.get("/status", (_req, res) => {
  res.json({
    mode: env.PAPER_TRADING ? "paper" : "live",
    defaultSymbol: env.DEFAULT_SYMBOL,
    portfolioSnapshot,
    queue: queueService.getStatus()
  });
});

v1Router.get("/infra/status", async (_req, res) => {
  const status = await infraStatusService.getStatus();

  res.json(status);
});

v1Router.get("/queue/status", (_req, res) => {
  res.json({
    ok: true,
    queue: queueService.getStatus()
  });
});

v1Router.get("/queue/schedules", (_req, res) => {
  res.json({
    ok: true,
    schedules: queueService.listSchedules()
  });
});

v1Router.post("/queue/schedules/sync", async (_req, res) => {
  const schedules = await queueService.syncSchedules();

  res.json({
    ok: true,
    schedules
  });
});

v1Router.post("/queue/enqueue/daily-cycle", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("daily-cycle", {
    triggeredBy: "api",
    note: parsed.data.note
  });

  res.json({ ok: true, result });
});

v1Router.post("/queue/enqueue/publish-summary", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("publish-summary", {
    triggeredBy: "api",
    note: parsed.data.note,
    platform: parsed.data.platform
  });

  res.json({ ok: true, result });
});

v1Router.post("/queue/enqueue/render-weekly-video", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("render-weekly-video", {
    triggeredBy: "api",
    note: parsed.data.note,
    symbol: parsed.data.symbol
  });

  res.json({ ok: true, result });
});

v1Router.post("/queue/enqueue/refresh-x-metrics", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success || !parsed.data.tweetId) {
    res.status(400).json({ ok: false, errors: parsed.success ? { tweetId: ["Required"] } : parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("refresh-x-metrics", {
    triggeredBy: "api",
    note: parsed.data.note,
    tweetId: parsed.data.tweetId,
    publicationTargetId: parsed.data.publicationTargetId
  });

  res.json({ ok: true, result });
});

v1Router.post("/queue/enqueue/refresh-recent-x-metrics", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("refresh-recent-x-metrics", {
    triggeredBy: "api",
    note: parsed.data.note,
    limit: parsed.data.limit
  });

  res.json({ ok: true, result });
});

v1Router.post("/queue/enqueue/generate-platform-content", async (req, res) => {
  const parsed = enqueueSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, errors: parsed.error.flatten() });
    return;
  }

  const result = await queueService.enqueue("generate-platform-content", {
    triggeredBy: "api",
    note: parsed.data.note,
    symbol: parsed.data.symbol
  });

  res.json({ ok: true, result });
});

v1Router.get("/trading/account", async (_req, res) => {
  const account = await alpacaTradingClient.getAccount();

  res.json({
    ok: true,
    account
  });
});

v1Router.post("/strategies/trading/run", async (_req, res) => {
  const intent = strategyService.buildDailyIntent(env.DEFAULT_SYMBOL, portfolioSnapshot);
  const decision = riskGuard.evaluate(intent, portfolioSnapshot);
  const strategyRunResult = await persistenceService.createStrategyRun({
    strategyName: "Daily ETF Allocation",
    strategyType: "trading",
    inputSnapshot: {
      portfolioSnapshot,
      symbol: env.DEFAULT_SYMBOL
    },
    outputSnapshot: {
      decision
    },
    status: decision.allowed ? "completed" : "blocked",
    notes: decision.allowed ? "Risk checks passed" : decision.reasons.join("; ")
  });

  if (!decision.allowed || !decision.intent) {
    res.status(200).json({
      ok: true,
      executed: false,
      decision,
      persistence: strategyRunResult
    });
    return;
  }

  if (!env.PAPER_TRADING) {
    res.status(400).json({
      ok: false,
      message: "Live trading is intentionally blocked in this scaffold. Use paper mode."
    });
    return;
  }

  const order = alpacaTradingClient.isConfigured()
    ? await alpacaTradingClient.submitMarketOrder(decision.intent)
    : await paperBroker.submit(decision.intent);

  const orderResult = await persistenceService.createOrder({
    strategyRunId: strategyRunResult.ok ? strategyRunResult.data.id : undefined,
    symbol: decision.intent.symbol,
    side: decision.intent.side,
    orderType: "market",
    quantity: decision.intent.quantity,
    status: order.status,
    brokerOrderId:
      "brokerOrderId" in order && typeof order.brokerOrderId === "string"
        ? order.brokerOrderId
        : undefined
  });

  res.json({
    ok: true,
    executed: true,
    decision,
    order,
    persistence: {
      strategyRun: strategyRunResult,
      order: orderResult
    }
  });
});

v1Router.post("/content/ideas/generate", (_req, res) => {
  res.json({
    ok: true,
    ideas: contentPlanner.generateDailyIdeas(env.DEFAULT_SYMBOL)
  });
});

v1Router.post("/content/platform-packages", (req, res) => {
  const symbol = typeof req.body?.symbol === "string" ? req.body.symbol : env.DEFAULT_SYMBOL;

  res.json({
    ok: true,
    packages: contentPlanner.generatePlatformPackages(symbol)
  });
});

v1Router.post("/publish/discord", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message : "Daily ATMA status update";
  const result = await discordPublisher.publish(message);
  const publication = await persistenceService.createPublication({
    platform: "discord",
    title: "Discord update",
    captionText: message,
    status: result.status === "published" ? "published" : "queued"
  });
  res.json({ ok: true, result, publication });
});

v1Router.post("/publish/x", async (req, res) => {
  const text =
    typeof req.body?.text === "string"
      ? req.body.text
      : `ATMA daily update: reviewed ${env.DEFAULT_SYMBOL}, applied risk checks, and prepared next content cycle.`;
  const result = await xPublisher.publish(text);
  const publication = await persistenceService.createPublication({
    platform: "x",
    title: "X update",
    captionText: text,
    status: result.status === "published" ? "published" : "queued"
  });
  res.json({ ok: true, result, publication });
});

v1Router.get("/publish/x/account", async (_req, res) => {
  const result = await xPublisher.verifyAccount();

  res.json({
    ok: result.ok,
    result
  });
});

v1Router.post("/publications/:publicationTargetId/metrics", async (req, res) => {
  const parseResult = postMetricSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      errors: parseResult.error.flatten()
    });
    return;
  }

  const result = await persistenceService.createPostMetric({
    publicationTargetId: req.params.publicationTargetId,
    ...parseResult.data
  });

  res.json({
    ok: true,
    persistence: result
  });
});

v1Router.post("/render/weekly-summary", async (req, res) => {
  const parsed = renderVideoSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      errors: parsed.error.flatten()
    });
    return;
  }

  const symbol = parsed.data.symbol ?? env.DEFAULT_SYMBOL;
  const base = videoRenderService.buildDefaultInput(symbol);
  const render = await videoRenderService.renderWeeklySummary({
    ...base,
    title: parsed.data.title ?? base.title,
    cta: parsed.data.cta ?? base.cta,
    scenes: parsed.data.scenes ?? base.scenes,
    musicPath: parsed.data.musicPath ?? base.musicPath,
    voiceoverPath: parsed.data.voiceoverPath ?? base.voiceoverPath,
    musicVolume: parsed.data.musicVolume ?? base.musicVolume,
    voiceoverVolume: parsed.data.voiceoverVolume ?? base.voiceoverVolume
  });

  const persistence = await persistenceService.createMediaAsset({
    title: parsed.data.title ?? base.title,
    storageUrl: render.outputFile,
    mimeType: "video/mp4",
    assetType: "weekly-summary",
    durationSec: (parsed.data.scenes ?? base.scenes).length * env.VIDEO_SCENE_DURATION_SEC
  });

  res.json({
    ok: true,
    render,
    persistence
  });
});

v1Router.get("/analytics/x/:tweetId", async (req, res) => {
  const metrics = await xAnalyticsService.fetchTweetPublicMetrics(req.params.tweetId);

  res.json({
    ok: metrics.ok,
    metrics
  });
});
