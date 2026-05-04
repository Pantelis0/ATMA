"use client";

import { useState } from "react";
import { getApiUrlConfig } from "../lib/api-config";

const apiConfig = getApiUrlConfig();

async function request(path: string, options?: { method?: "GET" | "POST"; body?: Record<string, unknown> }) {
  if (!apiConfig.apiUrl) {
    throw new Error(apiConfig.configError ?? "API URL is not configured.");
  }

  const response = await fetch(`${apiConfig.apiUrl}${path}`, {
    method: options?.method ?? "POST",
    headers:
      options?.method === "GET"
        ? undefined
        : {
            "content-type": "application/json"
          },
    body: options?.method === "GET" ? undefined : JSON.stringify(options?.body ?? {})
  });

  return response.json();
}

export function ActionPanel() {
  const [result, setResult] = useState<string>("No actions run yet.");
  const [loading, setLoading] = useState<string | null>(null);
  const [tweetId, setTweetId] = useState("");
  const [symbol, setSymbol] = useState("VT");

  async function run(label: string, path: string, body: Record<string, unknown>) {
    setLoading(label);
    try {
      const data = await request(path, { method: "POST", body });
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card half">
      <h2 className="card-title">Control panel</h2>
      <p className="card-subtitle">Trigger core ATMA flows from the admin UI.</p>

      {apiConfig.configError ? <div className="list-item status-bad">{apiConfig.configError}</div> : null}

      <div className="actions">
        <div className="action-row">
          <button
            className="btn"
            disabled={loading !== null}
            onClick={() => run("daily", "/v1/queue/enqueue/daily-cycle", { note: "Dashboard manual trigger" })}
          >
            {loading === "daily" ? "Running daily cycle..." : "Run daily cycle"}
          </button>

          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("x", "/v1/queue/enqueue/publish-summary", { platform: "x" })}
          >
            {loading === "x" ? "Publishing X..." : "Publish X summary"}
          </button>

          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("discord", "/v1/queue/enqueue/publish-summary", { platform: "discord" })}
          >
            {loading === "discord" ? "Publishing Discord..." : "Publish Discord summary"}
          </button>
          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("video", "/v1/render/weekly-summary", {})}
          >
            {loading === "video" ? "Rendering video..." : "Render weekly video"}
          </button>
          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("platforms", "/v1/content/platform-packages", { symbol: symbol.trim() || "VT" })}
          >
            {loading === "platforms" ? "Generating..." : "Platform content packages"}
          </button>
          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("schedules", "/v1/queue/schedules/sync", {})}
          >
            {loading === "schedules" ? "Syncing schedules..." : "Sync schedules"}
          </button>
        </div>

        <div className="action-row">
          <input
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="Symbol"
            style={{
              width: 140,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#0f1b27",
              color: "white",
              padding: "10px 12px"
            }}
          />
          <button
            className="btn secondary"
            disabled={loading !== null}
            onClick={() => run("recent-metrics", "/v1/queue/enqueue/refresh-recent-x-metrics", { limit: 5 })}
          >
            {loading === "recent-metrics" ? "Refreshing..." : "Refresh recent X metrics"}
          </button>
        </div>

        <div className="action-row">
          <input
            value={tweetId}
            onChange={(event) => setTweetId(event.target.value)}
            placeholder="X tweet id"
            style={{
              flex: 1,
              minWidth: 220,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "#0f1b27",
              color: "white",
              padding: "10px 12px"
            }}
          />
          <button
            className="btn secondary"
            disabled={loading !== null || !tweetId.trim()}
            onClick={async () => {
              setLoading("metrics");
              try {
                const data = await request(`/v1/analytics/x/${tweetId.trim()}`, { method: "GET" });
                setResult(JSON.stringify(data, null, 2));
              } catch (error) {
                setResult(error instanceof Error ? error.message : "Unknown error");
              } finally {
                setLoading(null);
              }
            }}
          >
            {loading === "metrics" ? "Refreshing metrics..." : "Fetch X metrics"}
          </button>
        </div>

        <div className="small">Results</div>
        <div className="list-item mono">{result}</div>
      </div>
    </div>
  );
}
