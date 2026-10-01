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

### If deploy logs show `Waiting for MySQL at mysql:3306` or port scan timeout

The API never reached Gunicorn because database env vars were missing or still set to Docker Compose defaults.

1. Render Dashboard → **Env Groups** → **tikitaka-data** → set **MYSQL_HOST** to your external MySQL hostname (e.g. PlanetScale, Railway, Aiven — not `mysql`).
2. Set **MYSQL_USER**, **MYSQL_PASSWORD**, and confirm **MYSQL_DATABASE** / **MYSQL_PORT**.
3. Ensure **tikitaka-api** is linked to **tikitaka-data** (Blueprint does this via `fromGroup`).
4. Redeploy **tikitaka-api**. Logs should show `Waiting for MySQL at <your-host>:3306` then bind on `$PORT`.

## URLs

- **App (users):** `https://tikitaka-web.onrender.com` (your actual name may differ)
- **API (direct):** `https://tikitaka-api.onrender.com` — browser should use **web** URL only.

## OAuth

Register redirect URIs on each provider using the **web** service URL:

`https://<tikitaka-web-host>/api/v1/auth/oauth/<provider>/callback`

## Local dev

Unchanged: `docker compose up` with full Kafka/Celery stack.

## Cron (optional, paid)

Render **Cron Jobs do not support the free plan** (only `starter` and above). The Blueprint skips cron so free deploy works.

- **Without cron:** match sync runs when users **link OAuth** (inline sync).
- **With cron:** Dashboard → **New** → **Cron Job** → Docker, root `backend`, `Dockerfile.job`, plan **Starter**, schedule `0 */2 * * *`, same env as API + `INGESTION_JOB=scheduled`.
