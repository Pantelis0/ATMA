import type { TradeIntent } from "@atma/shared";

type AlpacaAccountResponse = {
  id: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  equity: string;
  portfolio_value: string;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
  account_blocked?: boolean;
};

type AlpacaOrderResponse = {
  id: string;
  client_order_id: string;
  status: string;
  symbol: string;
  qty: string;
  side: "buy" | "sell";
  type: string;
  time_in_force: string;
};

export class AlpacaTradingClient {
  constructor(
    private readonly apiKey?: string,
    private readonly secretKey?: string,
    private readonly baseUrl = "https://paper-api.alpaca.markets"
  ) {}

  isConfigured() {
    return Boolean(this.apiKey && this.secretKey);
  }

  private getHeaders() {
    if (!this.apiKey || !this.secretKey) {
      throw new Error("Alpaca credentials are not configured");
    }

    return {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.secretKey,
      "content-type": "application/json"
    };
  }

  async getAccount() {
    if (!this.isConfigured()) {
      return {
        connected: false,
        reason: "ALPACA_API_KEY / ALPACA_SECRET_KEY not configured"
      };
    }

    const response = await fetch(`${this.baseUrl}/v2/account`, {
      method: "GET",
      headers: this.getHeaders()
    });

    if (!response.ok) {
      return {
        connected: false,
        code: response.status,
        reason: await response.text()
      };
    }

    const account = (await response.json()) as AlpacaAccountResponse;

    return {
      connected: true,
      mode: this.baseUrl.includes("paper-api") ? "paper" : "live",
      account: {
        id: account.id,
        status: account.status,
        currency: account.currency,
        buyingPower: Number(account.buying_power),
        cash: Number(account.cash),
        equity: Number(account.equity),
        portfolioValue: Number(account.portfolio_value),
        tradingBlocked: Boolean(account.trading_blocked || account.account_blocked),
        patternDayTrader: Boolean(account.pattern_day_trader)
      }
    };
  }

  async submitMarketOrder(intent: TradeIntent) {
    if (!this.isConfigured()) {
      return {
        status: "skipped",
        reason: "Alpaca credentials not configured"
      };
    }

    const response = await fetch(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        symbol: intent.symbol,
        qty: String(intent.quantity),
        side: intent.side,
        type: "market",
        time_in_force: "day"
      })
    });

    if (!response.ok) {
      return {
        status: "failed",
        code: response.status,
        reason: await response.text()
      };
    }

    const order = (await response.json()) as AlpacaOrderResponse;

    return {
      status: "submitted",
      mode: this.baseUrl.includes("paper-api") ? "paper" : "live",
      brokerOrderId: order.id,
      clientOrderId: order.client_order_id,
      orderStatus: order.status,
      symbol: order.symbol,
      qty: Number(order.qty),
      side: order.side,
      type: order.type,
      timeInForce: order.time_in_force
    };
  }
}

