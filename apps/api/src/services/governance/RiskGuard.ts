import type { PortfolioSnapshot, RiskLimits, TradeDecision, TradeIntent } from "@atma/shared";

export class RiskGuard {
  constructor(private readonly limits: RiskLimits) {}

  evaluate(intent: TradeIntent, portfolio: PortfolioSnapshot): TradeDecision {
    const reasons: string[] = [];

    if (portfolio.dailyPnlPct <= -this.limits.maxDailyLossPct) {
      reasons.push("Daily loss limit breached");
    }

    if (portfolio.drawdownPct <= -this.limits.maxDrawdownPct) {
      reasons.push("Max drawdown limit breached");
    }

    const currentWeight =
      portfolio.openPositions.find((position) => position.symbol === intent.symbol)?.weightPct ?? 0;

    if (currentWeight >= this.limits.maxPositionSizePct && intent.side === "buy") {
      reasons.push("Position size would exceed limit");
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      intent: reasons.length === 0 ? intent : undefined
    };
  }
}

