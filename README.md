# ATMA

Autonomous Treasury & Media Agent scaffold.

This is a **paper-trading-first** starter codebase for:

- treasury/trading orchestration
- content generation
- publishing adapters
- governance/risk controls

## Chosen stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** PostgreSQL
- **Queue/cache:** Redis
- **Infra:** Render for API + worker, Vercel for dashboard
- **Trading first target:** Alpaca paper trading
- **Publishing first targets:** X and Discord

## Current scope

This scaffold includes:

- monorepo workspace
- API app
- shared types package
- PostgreSQL schema draft
- Prisma persistence layer
- Docker Compose for Postgres + Redis
- BullMQ queue layer
- Redis-first scheduler with local fallback
- Next.js admin dashboard
- safe paper-trading services
- FFmpeg-based video rendering pipeline with dry-run bundle fallback
- X public-metrics analytics ingestion
- dashboard login protection
- cloud infra diagnostics for Postgres + Redis
- auto-refresh hooks for X metrics
- platform-specific content package generation
- optional voiceover/music support in renderer
- content idea generation service
- Discord/X publisher adapters

## Safety defaults

- paper trading by default
- risk checks before trade intents
- no autonomous withdrawals
- no debt or loan actions
- no fake identity handling

## Project structure

```text
ATMA/
  apps/
    api/
  packages/
    shared/
  prisma/
  docker-compose.yml
  .env.example
```

## Quickstart

### 1. Copy env

```bash
cp .env.example .env
```

### 2. Start local services

```bash
docker compose up -d
```

If Docker is unavailable, point `DATABASE_URL` at any running PostgreSQL instance instead.
For full BullMQ queue mode, Redis must also be running.

### 3. Install dependencies

```bash
npm install
```

### 4. Run the API

```bash
npm run dev
```

### 4b. Run the dashboard

```bash
npm run dev:dashboard
```

Then open:

```bash
http://localhost:3000
```

### 4c. Run the whole stack with one command

```bash
npm run up
```

This starts:

- API on `http://localhost:4000` by default
- Dashboard on `http://localhost:3000` by default (built, then served)

If either port is already in use, the launcher automatically picks the next free local port and prints the actual URLs at startup.

Default dashboard login:

- user: `admin`
- password: `change-me`

Change these in `.env` before real use.

### 4d. Stronger dashboard auth

ATMA now supports stronger signed sessions plus multi-user auth.

Recommended setup:

1. Generate a password hash:

```bash
npm run dashboard:hash-password -- "your-password"
```

2. Put the hash into `.env`:

```bash
DASHBOARD_USERS_JSON=[{"username":"owner","role":"owner","passwordHash":"scrypt:..."}]
```

Supported roles:

- `owner`
- `operator`
- `viewer`

Also set:

```bash
DASHBOARD_SESSION_SECRET=replace-with-a-random-secret
DASHBOARD_SESSION_MAX_AGE_SEC=604800
```

If `DASHBOARD_USERS_JSON` is missing, ATMA falls back to `DASHBOARD_ADMIN_USER` and `DASHBOARD_ADMIN_PASSWORD`.

### 4e. Recurring scheduled jobs

ATMA now auto-registers recurring BullMQ jobs when Redis is available.

Default schedules:

- `daily-cycle` → `0 10 * * 1-5`
- `refresh-recent-x-metrics` → `*/30 * * * *`
- `generate-platform-content` → `0 8 * * 1-5`
- `render-weekly-video` → `0 18 * * 5`
- X/Discord publishing schedules are disabled by default

Configure them in `.env`:

```bash
SCHEDULER_TIMEZONE=Europe/Athens
SCHEDULE_DAILY_CYCLE_CRON=0 10 * * 1-5
SCHEDULE_REFRESH_RECENT_X_METRICS_CRON=*/30 * * * *
SCHEDULE_GENERATE_PLATFORM_CONTENT_CRON=0 8 * * 1-5
SCHEDULE_RENDER_WEEKLY_VIDEO_CRON=0 18 * * 5
SCHEDULE_PUBLISH_X_SUMMARY_CRON=
SCHEDULE_PUBLISH_DISCORD_SUMMARY_CRON=
```

Inspect or re-sync schedules:

```bash
curl http://localhost:4000/v1/queue/schedules
curl -X POST http://localhost:4000/v1/queue/schedules/sync
```

## Dedicated production worker

ATMA now supports separate runtime roles:

- `ATMA_RUNTIME_ROLE=api`
- `ATMA_RUNTIME_ROLE=worker`
- `ATMA_RUNTIME_ROLE=all`

### Local default

For local development, ATMA still defaults to:

```bash
ATMA_RUNTIME_ROLE=all
```

That means one process can both expose the API and process jobs.

### Production recommendation

In production, split them:

- **API service** → `ATMA_RUNTIME_ROLE=api`
- **Worker service** → `ATMA_RUNTIME_ROLE=worker`

### Start commands

API:

```bash
ATMA_RUNTIME_ROLE=api npm run start:api
```

Worker:

```bash
ATMA_RUNTIME_ROLE=worker npm run start:worker
```

### Deployment files included

- `Dockerfile`
- `Procfile`
- `render.yaml`

### Render example

This repo now includes a Render blueprint with:

- `atma-api` web service
- `atma-worker` background worker

Both use the same image but different runtime roles.

## Cloud database and Redis

ATMA is now ready for cloud-hosted infrastructure.

Set:

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

Then verify:

```bash
npm run infra:check
```

Or open the dashboard and inspect the **Infrastructure** panel.

Recommended shape:

- Postgres: Supabase / Railway / Render / any managed PostgreSQL
- Redis: Upstash / Railway / any managed Redis

### Supabase + Upstash (recommended combo)

Use:

- **Supabase Postgres connection string**
- **Upstash Redis TCP/TLS URL**

#### Supabase

Open **Connect** in your Supabase project and copy a Postgres connection string.

Best choice for ATMA:

- **Direct connection** if your deployment supports IPv6
- **Supavisor session mode** if you need IPv4 compatibility

Supabase’s official connection string examples are:

- direct: `postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres`
- session pooler: `postgres://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

Paste into `.env` as:

```bash
DATABASE_URL=postgresql://...
```

#### Upstash

For **this codebase**, do **not** use the Upstash REST URL/token pair for the queue layer.
ATMA currently uses **ioredis + BullMQ**, so it needs the Redis client URL.

Upstash’s official TCP/ioredis examples use TLS, with a URL shape like:

```bash
REDIS_URL=rediss://default:<PASSWORD>@<YOUR-DATABASE>.upstash.io:6379
```

##### Exact Upstash checklist

1. Create or open your Redis database in Upstash
2. Open **Connect your client**
3. Copy:
   - endpoint
   - port
   - password
4. Build this URL:

```bash
REDIS_URL=rediss://default:<PASSWORD>@<ENDPOINT>:<PORT>
```

Example:

```bash
REDIS_URL=rediss://default:abc123@topical-mule-12345.upstash.io:6379
```

5. Paste it into `.env`
6. Run:

```bash
npm run infra:check
```

7. Then run:

```bash
npm run up
```

## X posting auth

ATMA now supports proper X posting via **OAuth 1.0a user context**.

Set:

```bash
X_CONSUMER_KEY=...
X_CONSUMER_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
```

Verify the connected X account:

```bash
curl http://localhost:4000/v1/publish/x/account
```

Publish a post:

```bash
curl -X POST http://localhost:4000/v1/publish/x \
  -H 'Content-Type: application/json' \
  --data '{"text":"ATMA test post"}'
```

When it works:

- Infrastructure panel → Redis = reachable
- Queue status should move from `local` to `redis`

#### Verify

After updating `.env`:

```bash
npm run infra:check
```

Then:

```bash
npm run up
```

The dashboard **Infrastructure** panel should show both services as reachable.

### 5. Generate Prisma client

```bash
npm run db:generate
```

### 6. Push schema to Postgres

```bash
npm run db:push
```

### 7. Test health

```bash
curl http://localhost:4000/health
```

### 8. Optional: connect Alpaca paper trading

Add these to `.env`:

```bash
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
ALPACA_BASE_URL=https://paper-api.alpaca.markets
PAPER_TRADING=true
```

Then check account connectivity:

```bash
curl http://localhost:4000/v1/trading/account
```

### 9. Queue + scheduler

Run the API:

```bash
npm run dev
```

Run a worker separately if you want a dedicated worker process:

```bash
npm run worker
```

Note: `npm run up` is the easiest local dev entrypoint. The separate worker is mainly useful once Redis is running and you want a dedicated worker process.

### 10. Build the dashboard

```bash
npm run build -w @atma/dashboard
```

### 11. Render a weekly summary video

```bash
curl -X POST http://localhost:4000/v1/render/weekly-summary \
  -H 'content-type: application/json' \
  -d '{}'
```

If `ffmpeg` is installed, this produces an MP4.
If not, it still creates a render bundle in `generated/media/...` with:

- `manifest.json`
- `concat.txt`
- `render.sh`

### 12. Fetch X public metrics

```bash
curl http://localhost:4000/v1/analytics/x/<tweet-id>
```

This uses X's `tweet.fields=public_metrics` lookup when `X_BEARER_TOKEN` is configured.

### 13. Generate platform-specific content packages

```bash
curl -X POST http://localhost:4000/v1/content/platform-packages \
  -H 'content-type: application/json' \
  -d '{"symbol":"VT"}'
```

### 14. Refresh recent X metrics automatically

```bash
curl -X POST http://localhost:4000/v1/queue/enqueue/refresh-recent-x-metrics \
  -H 'content-type: application/json' \
  -d '{"limit":5}'
```

### 15. Render with optional voiceover/music

```bash
curl -X POST http://localhost:4000/v1/render/weekly-summary \
  -H 'content-type: application/json' \
  -d '{
    "voiceoverPath":"/absolute/path/voiceover.mp3",
    "musicPath":"/absolute/path/music.mp3",
    "musicVolume":0.15,
    "voiceoverVolume":1.0
  }'
```

## Useful endpoints

- `GET /health`
- `GET /v1/status`
- `GET /v1/infra/status`
- `GET /v1/queue/status`
- `GET /v1/trading/account`
- `POST /v1/queue/enqueue/daily-cycle`
- `POST /v1/queue/enqueue/publish-summary`
- `POST /v1/queue/enqueue/render-weekly-video`
- `POST /v1/queue/enqueue/refresh-x-metrics`
- `POST /v1/queue/enqueue/refresh-recent-x-metrics`
- `POST /v1/queue/enqueue/generate-platform-content`
- `POST /v1/strategies/trading/run`
- `POST /v1/content/ideas/generate`
- `POST /v1/content/platform-packages`
- `POST /v1/publish/discord`
- `POST /v1/publish/x`
- `POST /v1/render/weekly-summary`
- `GET /v1/analytics/x/:tweetId`
- `POST /v1/publications/:publicationTargetId/metrics`

## Next recommended build order

1. add richer recurring schedules
2. split workers by job type
3. add TikTok/Meta analytics ingestion
4. add stronger dashboard auth/permissions beyond the starter gate
5. persist generated content packages for comparison over time
