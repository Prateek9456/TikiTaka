# Deploy TikiTaka on Render (restricted stack)

## Prerequisites

1. Code on GitHub (`TikiTaka-Django`).
2. [Render](https://dashboard.render.com/) account.
3. **External MySQL** database (any host).
4. **Upstash Redis** free database → `REDIS_URL` and `CELERY_BROKER_URL`.

## One-click Blueprint

1. Render Dashboard → **New** → **Blueprint**.
2. Connect this repository.
3. Render reads `render.yaml` at repo root.
4. When prompted, fill **sync: false** values in env group **tikitaka-data**:
   - `MYSQL_*`, `REDIS_URL`, `CELERY_BROKER_URL`
5. On **tikitaka-api**, set:
   - `JWT_SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY`
   - OAuth / Riot / Faceit keys as needed.
6. Wait for all services to go green (first deploy can take 10–20 minutes on free tier).

## URLs

- **App (users):** `https://tikitaka-web.onrender.com` (your actual name may differ)
- **API (direct):** `https://tikitaka-api.onrender.com` — browser should use **web** URL only.

## OAuth

Register redirect URIs on each provider using the **web** service URL:

`https://<tikitaka-web-host>/api/v1/auth/oauth/<provider>/callback`

## Local dev

Unchanged: `docker compose up` with full Kafka/Celery stack.

## Cron

`tikitaka-ingestion` runs every 2 hours (`INGESTION_JOB=scheduled`). Edit schedule in `render.yaml` or Dashboard.
