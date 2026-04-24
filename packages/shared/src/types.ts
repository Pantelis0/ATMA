export type RiskLimits = {
  maxPositionSizePct: number;
  maxDailyLossPct: number;
  maxDrawdownPct: number;
};

export type PortfolioSnapshot = {
  equity: number;
  cash: number;
  dailyPnlPct: number;
  drawdownPct: number;
  openPositions: Array<{
    symbol: string;
    marketValue: number;
    weightPct: number;
  }>;
};

export type TradeIntent = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  thesis: string;
};

export type TradeDecision = {
  allowed: boolean;
  reasons: string[];
  intent?: TradeIntent;
};

export type ContentIdea = {
  title: string;
  hook: string;
  cta: string;
  platform: "x" | "discord" | "tiktok" | "instagram";
};

