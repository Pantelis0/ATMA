import { getApiUrlConfig } from "./api-config";

const apiConfig = getApiUrlConfig();

async function fetchJson<T>(path: string): Promise<{ data?: T; error?: string }> {
  if (!apiConfig.apiUrl) {
    return {
      error: apiConfig.configError ?? "API URL is not configured."
    };
  }

  try {
    const response = await fetch(`${apiConfig.apiUrl}${path}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return { data: (await response.json()) as T };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export type StatusResponse = {
  mode: string;
  defaultSymbol: string;
  portfolioSnapshot: {
    equity: number;
    cash: number;
    dailyPnlPct: number;
    drawdownPct: number;
    openPositions: Array<{ symbol: string; marketValue: number; weightPct: number }>;
  };
  queue: {
    enabled: boolean;
    mode: string;
    localIntervalMs: number | null;
    schedules?: Array<{
      id: string;
      jobName: string;
      cron: string;
      timezone: string;
      description: string;
      active: boolean;
    }>;
  };
};

export type TradingAccountResponse = {
  ok: boolean;
  account: {
    connected: boolean;
    reason?: string;
    mode?: string;
    account?: {
      id: string;
      status: string;
      currency: string;
      buyingPower: number;
      cash: number;
      equity: number;
      portfolioValue: number;
      tradingBlocked: boolean;
      patternDayTrader: boolean;
    };
  };
};

export type QueueStatusResponse = {
  ok: boolean;
  queue: {
    enabled: boolean;
    mode: string;
    localIntervalMs: number | null;
    schedules?: Array<{
      id: string;
      jobName: string;
      cron: string;
      timezone: string;
      description: string;
      active: boolean;
    }>;
  };
};

export type QueueSchedulesResponse = {
  ok: boolean;
  schedules: Array<{
    id: string;
    jobName: string;
    cron: string;
    timezone: string;
    description: string;
    active: boolean;
  }>;
};

export type InfraStatusResponse = {
  ok: boolean;
  database: {
    configured: boolean;
    reachable: boolean;
    providerHint: string;
    error?: string;
  };
  redis: {
    configured: boolean;
    reachable: boolean;
    providerHint: string;
    error?: string;
  };
  env: {
    databaseUrlPresent: boolean;
    redisUrlPresent: boolean;
  };
};

export async function getDashboardData() {
  const [status, trading, queue, infra, schedules] = await Promise.all([
    fetchJson<StatusResponse>("/v1/status"),
    fetchJson<TradingAccountResponse>("/v1/trading/account"),
    fetchJson<QueueStatusResponse>("/v1/queue/status"),
    fetchJson<InfraStatusResponse>("/v1/infra/status"),
    fetchJson<QueueSchedulesResponse>("/v1/queue/schedules")
  ]);

  return {
    status,
    trading,
    queue,
    infra,
    schedules,
    apiUrl: apiConfig.apiUrl ?? "not-configured",
    apiConfigError: apiConfig.configError
  };
}
