import type { ContentIdea } from "@atma/shared";

export type PlatformContentPackage = {
  platform: "x" | "discord" | "instagram" | "tiktok";
  title: string;
  hook: string;
  body: string;
  caption: string;
  cta: string;
  assetPlan: string[];
};

export class ContentPlanner {
  generateDailyIdeas(symbol: string): ContentIdea[] {
    return [
      {
        title: `What the model did with ${symbol} today`,
        hook: `Today the treasury bot reviewed ${symbol} and made one simple decision.`,
        cta: "Follow for tomorrow's decision.",
        platform: "x"
      },
      {
        title: "Daily transparency report",
        hook: "Portfolio update, risk status, and next action in one post.",
        cta: "Join Discord for deeper logs.",
        platform: "discord"
      },
      {
        title: "Weekly recap short",
        hook: "This week the bot traded less and explained more.",
        cta: "Link in bio for the full report.",
        platform: "tiktok"
      }
    ];
  }

  generatePlatformPackages(symbol: string) {
    const packages: PlatformContentPackage[] = [
      {
        platform: "x",
        title: `ATMA daily take on ${symbol}`,
        hook: `The model reviewed ${symbol} today.`,
        body: "Risk stayed ahead of hype, and the execution stayed boring on purpose.",
        caption: `ATMA checked ${symbol}, enforced risk rules, and kept the process simple. #tradingbot #buildinpublic`,
        cta: "Follow for tomorrow’s decision.",
        assetPlan: ["single text post", "one simple chart", "reply thread with risk notes"]
      },
      {
        platform: "discord",
        title: "Daily transparency log",
        hook: `Daily treasury update for ${symbol}`,
        body: "Post the full context: thesis, risk state, next action, and queue status.",
        caption: `Treasury update for ${symbol} with operations context.`,
        cta: "Join the channel for deeper logs.",
        assetPlan: ["status embed", "portfolio screenshot", "link to weekly recap"]
      },
      {
        platform: "instagram",
        title: `${symbol} recap carousel`,
        hook: "3 slides: decision, risk, next step.",
        body: "Use clean bold headlines, one number per slide, and end with a CTA slide.",
        caption: `Inside today’s model workflow for ${symbol}. Process > prediction.`,
        cta: "Save this and follow for the next recap.",
        assetPlan: ["3-slide carousel", "story cutdown", "cover image"]
      },
      {
        platform: "tiktok",
        title: `${symbol} short recap`,
        hook: `If you’re building an automated trader, this is the boring part you need.`,
        body: "Fast hook, one decision, one lesson, one CTA. Keep it under 30 seconds.",
        caption: `This is how the system handled ${symbol} today.`,
        cta: "Follow for the weekly build log.",
        assetPlan: ["vertical talking-head script", "subtitles", "B-roll chart overlay"]
      }
    ];

    return {
      symbol,
      createdAt: new Date().toISOString(),
      packages
    };
  }
}
