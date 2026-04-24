import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ActionPanel } from "../components/ActionPanel";
import { getAuthenticatedSession, type DashboardRole } from "../lib/auth";
import { getDashboardData, type QueueSchedulesResponse, type StatusResponse } from "../lib/api";
import { SESSION_COOKIE_NAME } from "../lib/auth-shared";

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function roleLabel(role: DashboardRole) {
  if (role === "owner") return "Owner";
  if (role === "operator") return "Operator";
  return "Viewer";
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = await getAuthenticatedSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!session) {
    redirect("/login");
  }

  const { status, trading, queue, infra, schedules, apiUrl } = await getDashboardData();

  const portfolio = status.data?.portfolioSnapshot;
  const account = trading.data?.account;
  const queueInfo = queue.data?.queue ?? status.data?.queue;
  const recurringSchedules = schedules.data?.schedules ?? queueInfo?.schedules ?? [];

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1 className="title">ATMA Admin</h1>
          <p className="subtitle">
            Monitor the treasury engine, queue layer, and publishing controls for the Autonomous Treasury &amp;
            Media Agent.
          </p>
          <div className="badge-row">
            <span className="badge">API: {apiUrl}</span>
            <span className="badge">Trading: {status.data?.mode ?? "offline"}</span>
            <span className="badge">Queue: {queueInfo?.mode ?? "unknown"}</span>
            <span className="badge">Symbol: {status.data?.defaultSymbol ?? "n/a"}</span>
            <span className="badge">
              User: {session.username} ({roleLabel(session.role)})
            </span>
          </div>
        </div>
        <form action="/auth/logout" method="post">
          <button className="btn secondary" type="submit">
            Logout
          </button>
        </form>
      </header>

      <section className="grid">
        <div className="card half">
          <h2 className="card-title">Treasury overview</h2>
          <p className="card-subtitle">Live status from `/v1/status`</p>
          {portfolio ? (
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Equity</div>
                <div className="stat-value">€{portfolio.equity.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Cash</div>
                <div className="stat-value">€{portfolio.cash.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Daily PnL</div>
                <div className={`stat-value ${portfolio.dailyPnlPct >= 0 ? "status-ok" : "status-warn"}`}>
                  {pct(portfolio.dailyPnlPct)}
                </div>
              </div>
            </div>
          ) : (
            <div className="list-item mono">{status.error ?? "Status unavailable"}</div>
          )}

          <div className="footer-note">
            Open positions:
            <div className="list" style={{ marginTop: 10 }}>
              {portfolio?.openPositions?.length ? (
                portfolio.openPositions.map((position: StatusResponse["portfolioSnapshot"]["openPositions"][number]) => (
                  <div key={position.symbol} className="list-item">
                    <strong>{position.symbol}</strong> — €{position.marketValue.toLocaleString()} /{" "}
                    {pct(position.weightPct)}
                  </div>
                ))
              ) : (
                <div className="list-item">No positions found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card half">
          <h2 className="card-title">Broker connectivity</h2>
          <p className="card-subtitle">Live status from `/v1/trading/account`</p>
          {account?.connected && account.account ? (
            <div className="stat-grid">
              <div className="stat">
                <div className="stat-label">Mode</div>
                <div className="stat-value">{account.mode}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Buying power</div>
                <div className="stat-value">€{account.account.buyingPower.toLocaleString()}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Status</div>
                <div className={`stat-value ${account.account.tradingBlocked ? "status-bad" : "status-ok"}`}>
                  {account.account.status}
                </div>
              </div>
            </div>
          ) : (
            <div className="list-item">
              <div className="small">Connection</div>
              <div className="status-warn">{account?.reason ?? trading.error ?? "Broker not configured"}</div>
            </div>
          )}
        </div>

        <div className="card third">
          <h2 className="card-title">Queue status</h2>
          <p className="card-subtitle">Scheduler and worker mode</p>
          <div className="list">
            <div className="list-item">
              <div className="small">Enabled</div>
              <strong>{String(queueInfo?.enabled ?? false)}</strong>
            </div>
            <div className="list-item">
              <div className="small">Mode</div>
              <strong>{queueInfo?.mode ?? "unknown"}</strong>
            </div>
            <div className="list-item">
              <div className="small">Local interval</div>
              <strong>{queueInfo?.localIntervalMs ?? "n/a"}</strong>
            </div>
          </div>
        </div>

        <div className="card third">
          <h2 className="card-title">Recurring schedules</h2>
          <p className="card-subtitle">Redis-backed recurring jobs</p>
          <div className="list">
            {recurringSchedules.length ? (
              recurringSchedules.map((schedule: QueueSchedulesResponse["schedules"][number]) => (
                <div className="list-item" key={schedule.id}>
                  <div>
                    <strong>{schedule.id}</strong>
                    <div className="small">{schedule.description}</div>
                  </div>
                  <div className="small">
                    {schedule.active ? `${schedule.cron} (${schedule.timezone})` : "disabled"}
                  </div>
                </div>
              ))
            ) : (
              <div className="list-item">No recurring schedules configured.</div>
            )}
          </div>
        </div>

        <div className="card third">
          <h2 className="card-title">Infrastructure</h2>
          <p className="card-subtitle">Cloud connectivity for persistence and queues</p>
          <div className="list">
            <div className="list-item">
              <div className="small">Database</div>
              <strong className={infra.data?.database.reachable ? "status-ok" : "status-warn"}>
                {infra.data?.database.reachable ? "Reachable" : "Not reachable"}
              </strong>
              <div className="small">{infra.data?.database.providerHint ?? "Unknown"}</div>
            </div>
            <div className="list-item">
              <div className="small">Redis</div>
              <strong className={infra.data?.redis.reachable ? "status-ok" : "status-warn"}>
                {infra.data?.redis.reachable ? "Reachable" : "Not reachable"}
              </strong>
              <div className="small">{infra.data?.redis.providerHint ?? "Unknown"}</div>
            </div>
          </div>
        </div>

        <div className="card third">
          <h2 className="card-title">Platform readiness</h2>
          <p className="card-subtitle">Current scaffold status</p>
          <div className="list">
            <div className="list-item">X: connected via API token when configured</div>
            <div className="list-item">Discord: webhook publishing ready</div>
            <div className="list-item">Alpaca: paper trading ready</div>
          </div>
        </div>

        <div className="card third">
          <h2 className="card-title">System notes</h2>
          <p className="card-subtitle">What still needs infrastructure</p>
          <div className="list">
            <div className="list-item">Postgres must be reachable for persistence writes.</div>
            <div className="list-item">Redis enables full BullMQ worker mode.</div>
            <div className="list-item">FFmpeg is required for actual MP4 rendering.</div>
          </div>
        </div>

        <ActionPanel />

        <div className="card half">
          <h2 className="card-title">Raw API diagnostics</h2>
          <p className="card-subtitle">Useful while building the next modules.</p>
          <div className="list">
            <div className="list-item">
              <div className="small">Status response</div>
              <div className="mono">{JSON.stringify(status.data ?? status.error, null, 2)}</div>
            </div>
            <div className="list-item">
              <div className="small">Trading account response</div>
              <div className="mono">{JSON.stringify(trading.data ?? trading.error, null, 2)}</div>
            </div>
            <div className="list-item">
              <div className="small">Queue response</div>
              <div className="mono">{JSON.stringify(queue.data ?? queue.error, null, 2)}</div>
            </div>
            <div className="list-item">
              <div className="small">Infra response</div>
              <div className="mono">{JSON.stringify(infra.data ?? infra.error, null, 2)}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
