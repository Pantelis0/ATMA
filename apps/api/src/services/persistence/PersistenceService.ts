import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

type StrategyRunInput = {
  strategyName: string;
  strategyType: string;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  status?: string;
  notes?: string;
};

type OrderInput = {
  strategyRunId?: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice?: number;
  status: string;
  brokerOrderId?: string;
};

type PublicationInput = {
  platform: string;
  title: string;
  captionText?: string;
  status: string;
  externalPostId?: string;
};

type MediaAssetInput = {
  title: string;
  storageUrl: string;
  mimeType: string;
  assetType: string;
  durationSec?: number;
};

type PostMetricInput = {
  publicationTargetId: string;
  impressions?: number;
  engagements?: number;
  clicks?: number;
  shares?: number;
  comments?: number;
  followersDelta?: number;
  revenueAttributed?: number;
};

export class PersistenceService {
  private async safe<T>(operation: () => Promise<T>) {
    try {
      return {
        ok: true as const,
        data: await operation()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      return {
        ok: false as const,
        error: message
      };
    }
  }

  private async ensureDefaultSetup() {
    const entity =
      (await prisma.entity.findFirst({
        where: { name: env.ATMA_ENTITY_NAME }
      })) ??
      (await prisma.entity.create({
        data: {
          name: env.ATMA_ENTITY_NAME,
          legalName: env.ATMA_ENTITY_NAME,
          timezone: "Europe/Athens",
          baseCurrency: "EUR"
        }
      }));

    const portfolio =
      (await prisma.portfolio.findFirst({
        where: { entityId: entity.id, name: "Main Treasury" }
      })) ??
      (await prisma.portfolio.create({
        data: {
          entityId: entity.id,
          name: "Main Treasury",
          baseCurrency: "EUR",
          status: "active"
        }
      }));

    const strategy =
      (await prisma.strategy.findFirst({
        where: { entityId: entity.id, name: "Daily ETF Allocation" }
      })) ??
      (await prisma.strategy.create({
        data: {
          entityId: entity.id,
          strategyType: "trading",
          name: "Daily ETF Allocation",
          version: "v1",
          status: "active",
          configJson: {
            symbol: env.DEFAULT_SYMBOL,
            paperTrading: env.PAPER_TRADING
          }
        }
      }));

    return { entity, portfolio, strategy };
  }

  async createStrategyRun(input: StrategyRunInput) {
    return this.safe(async () => {
      const { strategy } = await this.ensureDefaultSetup();
      return prisma.strategyRun.create({
        data: {
          strategyId: strategy.id,
          status: input.status ?? "completed",
          inputSnapshotJson: (input.inputSnapshot ?? {}) as Prisma.InputJsonValue,
          outputSnapshotJson: (input.outputSnapshot ?? {}) as Prisma.InputJsonValue,
          notes: input.notes
        }
      });
    });
  }

  async createOrder(input: OrderInput) {
    return this.safe(async () => {
      const { portfolio } = await this.ensureDefaultSetup();
      return prisma.order.create({
        data: {
          portfolioId: portfolio.id,
          strategyRunId: input.strategyRunId,
          brokerOrderId: input.brokerOrderId,
          symbol: input.symbol,
          side: input.side,
          orderType: input.orderType,
          quantity: input.quantity,
          limitPrice: input.limitPrice,
          status: input.status,
          submittedAt: new Date()
        }
      });
    });
  }

  async createPublication(input: PublicationInput) {
    return this.safe(async () => {
      const { entity } = await this.ensureDefaultSetup();
      const contentItem = await prisma.contentItem.create({
        data: {
          entityId: entity.id,
          contentType: "text",
          theme: input.platform,
          title: input.title,
          captionText: input.captionText,
          status: input.status
        }
      });

      return prisma.publicationTarget.create({
        data: {
          contentItemId: contentItem.id,
          platform: input.platform,
          status: input.status,
          externalPostId: input.externalPostId,
          publishedAt: input.status === "published" ? new Date() : null
        }
      });
    });
  }

  async createPostMetric(input: PostMetricInput) {
    return this.safe(async () =>
      prisma.postMetric.create({
        data: {
          publicationTargetId: input.publicationTargetId,
          impressions: input.impressions ?? 0,
          engagements: input.engagements ?? 0,
          clicks: input.clicks ?? 0,
          shares: input.shares ?? 0,
          comments: input.comments ?? 0,
          followersDelta: input.followersDelta ?? 0,
          revenueAttributed: input.revenueAttributed ?? 0
        }
      })
    );
  }

  async getPublicationTarget(publicationTargetId: string) {
    return this.safe(async () =>
      prisma.publicationTarget.findUnique({
        where: { id: publicationTargetId }
      })
    );
  }

  async listRecentXPublications(limit = 10) {
    return this.safe(async () =>
      prisma.publicationTarget.findMany({
        where: {
          platform: "x",
          externalPostId: {
            not: null
          }
        },
        orderBy: {
          publishedAt: "desc"
        },
        take: limit
      })
    );
  }

  async createMediaAsset(input: MediaAssetInput) {
    return this.safe(async () => {
      const { entity } = await this.ensureDefaultSetup();
      const contentItem = await prisma.contentItem.create({
        data: {
          entityId: entity.id,
          contentType: "video",
          theme: "rendered-video",
          title: input.title,
          status: "rendered"
        }
      });

      return prisma.mediaAsset.create({
        data: {
          contentItemId: contentItem.id,
          assetType: input.assetType,
          storageUrl: input.storageUrl,
          mimeType: input.mimeType,
          durationSec: input.durationSec
        }
      });
    });
  }
}
