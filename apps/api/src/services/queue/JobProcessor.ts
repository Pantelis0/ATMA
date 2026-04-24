import type { PublicationTarget } from "@prisma/client";
import { env } from "../../config/env.js";
import { ContentPlanner } from "../content/ContentPlanner.js";
import { PersistenceService } from "../persistence/PersistenceService.js";
import { XPublisher } from "../publishing/XPublisher.js";
import { DiscordWebhookPublisher } from "../publishing/DiscordWebhookPublisher.js";
import { RiskGuard } from "../governance/RiskGuard.js";
import { VideoRenderService } from "../render/VideoRenderService.js";
import { XAnalyticsService } from "../analytics/XAnalyticsService.js";
import { StrategyService } from "../strategy/StrategyService.js";
import { AlpacaTradingClient } from "../trading/AlpacaTradingClient.js";
import { PaperBroker } from "../trading/PaperBroker.js";
import type { QueueJobName, QueueJobPayload } from "./types.js";

const portfolioSnapshot = {
  equity: 10000,
  cash: 1500,
  dailyPnlPct: -0.003,
  drawdownPct: -0.012,
  openPositions: [{ symbol: env.DEFAULT_SYMBOL, marketValue: 900, weightPct: 0.09 }]
};

export class JobProcessor {
  private readonly persistenceService = new PersistenceService();
  private readonly strategyService = new StrategyService();
  private readonly paperBroker = new PaperBroker();
  private readonly alpacaTradingClient = new AlpacaTradingClient(
    env.ALPACA_API_KEY,
    env.ALPACA_SECRET_KEY,
    env.ALPACA_BASE_URL
  );
  private readonly riskGuard = new RiskGuard({
    maxPositionSizePct: env.MAX_POSITION_SIZE_PCT,
    maxDailyLossPct: env.MAX_DAILY_LOSS_PCT,
    maxDrawdownPct: env.MAX_DRAWDOWN_PCT
  });
  private readonly contentPlanner = new ContentPlanner();
  private readonly xPublisher = new XPublisher(
    env.X_CONSUMER_KEY,
    env.X_CONSUMER_SECRET,
    env.X_ACCESS_TOKEN,
    env.X_ACCESS_TOKEN_SECRET
  );
  private readonly xAnalyticsService = new XAnalyticsService(env.X_BEARER_TOKEN);
  private readonly discordPublisher = new DiscordWebhookPublisher(env.DISCORD_WEBHOOK_URL);
  private readonly videoRenderService = new VideoRenderService();

  async process(jobName: QueueJobName, payload: QueueJobPayload) {
    if (jobName === "daily-cycle") {
      return this.runDailyCycle(payload);
    }

    if (jobName === "publish-summary") {
      return this.publishSummary(payload);
    }

    if (jobName === "render-weekly-video") {
      return this.renderWeeklyVideo(payload);
    }

    if (jobName === "refresh-x-metrics") {
      return this.refreshXMetrics(payload);
    }

    if (jobName === "refresh-recent-x-metrics") {
      return this.refreshRecentXMetrics(payload);
    }

    if (jobName === "generate-platform-content") {
      return this.generatePlatformContent(payload);
    }

    return { ok: false, message: `Unknown job ${jobName}` };
  }

  private async runDailyCycle(payload: QueueJobPayload) {
    const intent = this.strategyService.buildDailyIntent(env.DEFAULT_SYMBOL, portfolioSnapshot);
    const decision = this.riskGuard.evaluate(intent, portfolioSnapshot);

    const strategyRunResult = await this.persistenceService.createStrategyRun({
      strategyName: "Daily ETF Allocation",
      strategyType: "trading",
      inputSnapshot: { portfolioSnapshot, payload },
      outputSnapshot: { decision },
      status: decision.allowed ? "completed" : "blocked",
      notes: decision.allowed ? "Queued daily cycle completed" : decision.reasons.join("; ")
    });

    if (!decision.allowed || !decision.intent) {
      return {
        ok: true,
        executed: false,
        decision,
        persistence: strategyRunResult
      };
    }

    const order = env.PAPER_TRADING
      ? this.alpacaTradingClient.isConfigured()
        ? await this.alpacaTradingClient.submitMarketOrder(decision.intent)
        : await this.paperBroker.submit(decision.intent)
      : { status: "blocked", reason: "Live mode disabled in scaffold" };

    const orderResult = await this.persistenceService.createOrder({
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

    return {
      ok: true,
      executed: true,
      decision,
      order,
      persistence: {
        strategyRun: strategyRunResult,
        order: orderResult
      }
    };
  }

  private async publishSummary(payload: QueueJobPayload) {
    const ideas = this.contentPlanner.generateDailyIdeas(env.DEFAULT_SYMBOL);
    const selected = ideas.find((idea) => idea.platform === (payload.platform ?? "x")) ?? ideas[0];
    const message = `${selected.hook} ${selected.cta}`;

    const publishResult =
      (payload.platform ?? "x") === "discord"
        ? await this.discordPublisher.publish(message)
        : await this.xPublisher.publish(message);

    const publication = await this.persistenceService.createPublication({
      platform: payload.platform ?? "x",
      title: selected.title,
      captionText: message,
      status: publishResult.status === "published" ? "published" : "queued",
      externalPostId:
        "externalPostId" in publishResult && typeof publishResult.externalPostId === "string"
          ? publishResult.externalPostId
          : undefined
    });

    const analyticsRefresh =
      (payload.platform ?? "x") === "x" &&
      publication.ok &&
      publication.data.externalPostId
        ? await this.refreshXMetrics({
            triggeredBy: "worker",
            tweetId: publication.data.externalPostId,
            publicationTargetId: publication.data.id
          })
        : null;

    return {
      ok: true,
      publishResult,
      publication,
      analyticsRefresh
    };
  }

  private async renderWeeklyVideo(payload: QueueJobPayload) {
    const symbol = payload.symbol ?? env.DEFAULT_SYMBOL;
    const render = await this.videoRenderService.renderWeeklySummary(this.videoRenderService.buildDefaultInput(symbol));
    const persistence = await this.persistenceService.createMediaAsset({
      title: `ATMA Weekly Summary ${symbol}`,
      storageUrl: render.outputFile,
      mimeType: "video/mp4",
      assetType: "weekly-summary",
      durationSec: env.VIDEO_SCENE_DURATION_SEC * 3
    });

    return {
      ok: true,
      render,
      persistence
    };
  }

  private async refreshXMetrics(payload: QueueJobPayload) {
    if (!payload.tweetId) {
      return { ok: false, message: "tweetId is required" };
    }

    const metrics = await this.xAnalyticsService.fetchTweetPublicMetrics(payload.tweetId);

    if (!metrics.ok) {
      return { ok: false, metrics };
    }

    const persistence =
      payload.publicationTargetId
        ? await this.persistenceService.createPostMetric({
            publicationTargetId: payload.publicationTargetId,
            impressions: metrics.metrics.impressions,
            engagements: metrics.metrics.engagements,
            clicks: metrics.metrics.clicks,
            shares: metrics.metrics.shares,
            comments: metrics.metrics.comments
          })
        : null;

    return {
      ok: true,
      metrics,
      persistence
    };
  }

  private async refreshRecentXMetrics(payload: QueueJobPayload) {
    const publications = await this.persistenceService.listRecentXPublications(payload.limit ?? 5);

    if (!publications.ok) {
      return {
        ok: false,
        publications
      };
    }

    const results = await Promise.all(
      publications.data.map((publication: PublicationTarget) =>
        this.refreshXMetrics({
          triggeredBy: "worker",
          tweetId: publication.externalPostId ?? undefined,
          publicationTargetId: publication.id
        })
      )
    );

    return {
      ok: true,
      refreshed: results.length,
      results
    };
  }

  private async generatePlatformContent(payload: QueueJobPayload) {
    const symbol = payload.symbol ?? env.DEFAULT_SYMBOL;
    const packages = this.contentPlanner.generatePlatformPackages(symbol);

    return {
      ok: true,
      packages
    };
  }
}
