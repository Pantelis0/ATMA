# ATMA production launch

This is the shortest path to a real live ATMA deployment using:

- Render for `atma-api`
- Render for `atma-worker`
- Vercel for the dashboard
- Prisma Postgres for the database
- Redis Cloud for BullMQ

## What this repo now handles for you

- API and worker split already prepared in `render.yaml`
- dashboard refuses to silently use `localhost` in production
- API supports locked-down browser CORS with `CORS_ALLOWED_ORIGINS`
- Docker image now includes `ffmpeg` and Linux fonts for server-side video rendering
- video renderer now auto-detects a usable font path on macOS and Linux
- default audio assets are wired to repo-local files

## You still must do these manually

These require your accounts and secrets:

1. Create the Render services
2. Create the Vercel dashboard project
3. Set all secrets/env vars in Render and Vercel
4. Create DNS records for your public domains
5. Verify broker/X/Discord credentials
6. Change Redis eviction policy to `noeviction`

## Recommended public URLs

- API: `https://api.atma.yourdomain.com`
- Dashboard: `https://app.atma.yourdomain.com`

## Render: API service

Create a Render web service from this repo root.

- Name: `atma-api`
- Runtime: Docker
- Start command: already handled by `render.yaml`
- Health check path: `/health`

Set env vars:

- everything under “Shared: API + worker” in `.env.production.example`
- do **not** set `NEXT_PUBLIC_ATMA_API_URL` here unless you also want the dashboard code available in the same environment

## Render: worker service

Create a Render background worker from the same repo.

- Name: `atma-worker`
- Runtime: Docker
- Start command: already handled by `render.yaml`

Set the same shared env vars as the API service.

## Vercel: dashboard

Create a Vercel project with:

- Root directory: `apps/dashboard`

Set env vars:

- `NEXT_PUBLIC_ATMA_API_URL=https://api.atma.yourdomain.com`
- `DASHBOARD_SESSION_SECRET`
- `DASHBOARD_SESSION_MAX_AGE_SEC=604800`
- `DASHBOARD_USERS_JSON=[{"username":"owner","role":"owner","passwordHash":"scrypt:..."}]`

## Create a strong dashboard password hash

From the repo root:

```bash
npm run dashboard:hash-password -- "your-strong-password"
```

Copy the resulting `scrypt:...` string into `DASHBOARD_USERS_JSON`.

## DNS

Create these DNS records:

- `api.atma.yourdomain.com` → Render service
- `app.atma.yourdomain.com` → Vercel project

## Required first smoke test

Run these in order after deploy:

1. `GET /health`
2. `GET /v1/infra/status`
3. `GET /v1/queue/status`
4. dashboard login works
5. dashboard shows live API URL, not `localhost`
6. `Sync schedules`
7. `Publish X summary`
8. `Render weekly video`
9. confirm worker logs show job completion

## Important note about media durability

Right now ATMA renders to container-local storage:

- `./generated/media`

That is okay for first live launch and testing, but not durable long-term.

For the next upgrade, add S3/R2/Supabase Storage and persist public URLs instead of local container paths.
