import type { PortfolioSnapshot, TradeIntent } from "@atma/shared";

export class StrategyService {
  buildDailyIntent(symbol: string, portfolio: PortfolioSnapshot): TradeIntent {
    const quantity = portfolio.cash >= 100 ? 1 : 0;

    return {
      symbol,
      side: "buy",
      quantity,
      thesis: "Low-frequency recurring allocation into a broad diversified ETF."
    };
  }
}

