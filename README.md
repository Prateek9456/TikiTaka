# TikiTaka AI

TikiTaka AI is a full-stack platform for competitive gaming analytics: users sign in, link game accounts, ingest match data from official APIs, and explore patterns and match insights powered by a dedicated ML service.

## Architecture

```
Browser → Nginx → React (SPA)     UI
              → Django REST API   Auth, games, matches, ingestion triggers
                    ↓
              MySQL               Primary data store
              Redis               Cache, OAuth state, Celery broker
              Kafka               Async match-event pipeline
              Celery              Scheduled ingestion and background jobs
              FastAPI (ML)        Pattern detection and analysis
```

| Component | Role |
|-----------|------|
| **frontend** | React + Vite SPA |
| **backend** | Django 5 + DRF, JWT/CSRF auth, OAuth providers |
| **ml-service** | FastAPI inference and analytics |
| **nginx** | Single entry on port 80: `/api` and `/actuator` → API, `/` → UI |

API base path: `/api/v1`. Responses use a standard envelope: `{ success, message?, data, error?, timestamp }`.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Optional for local backend-only dev: Python 3.12, Node.js (see frontend `package.json`)

## Run locally (recommended)

```bash
cp .env.example .env
# Set secrets and provider keys in .env (see below)

docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost | App via Nginx (API + UI) |
| http://localhost:3000 | Frontend container (direct) |
| http://localhost:8080/api/v1 | API (direct) |
| http://localhost:8000 | ML service |
| http://localhost:8080/actuator/health | API health |

MySQL is exposed on host port **3307** if you need a SQL client.

## Configuration

Copy `.env.example` to `.env` before first run. Important groups:

- **Auth**: `JWT_SECRET` (base64, ≥256 bits), `OAUTH_TOKEN_ENCRYPTION_KEY` (base64 AES-256 for stored provider tokens)
- **OAuth**: Google, Riot, Steam, Faceit, Epic — each needs client credentials and redirect URIs registered with the provider (defaults assume `http://localhost` through Nginx)
- **Ingestion**: `RIOT_API_KEY`, `FACEIT_API_KEY` (server-side only); match pulls use each user's linked accounts—cron via `TIKITAKA_INGESTION_CRON` and `TIKITAKA_USER_POLLER_CRON`
- **Production**: set `PUBLIC_APP_URL` to your public origin, `COOKIE_SECURE=true`, and align `CORS_ALLOWED_ORIGINS` and OAuth redirect URLs with that host
- **Email**: SMTP vars for password-reset OTPs; without SMTP, OTPs may be logged in dev

Set `KAFKA_ENABLED=false` in the backend environment if you want a synchronous in-process pipeline (advanced; default in Compose is Kafka on).

## Backend development (without full stack)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Infra only:
docker compose up -d mysql redis kafka zookeeper

python manage.py migrate
python manage.py runserver 8080
```

Point the frontend at `http://localhost:8080` (or use Vite proxy settings in the frontend project).

## Repository layout

```
backend/apps/
  core/         Shared API utilities, JWT, CSRF
  accounts/     Users, OAuth, password reset
  games/        Games, players, patterns
  matches/      Matches, events, scores
  ingestion/    External game API clients, Kafka publish, schedulers
  processing/   Event normalization, Kafka consumers
  analytics/    ML service integration
  api/          HTTP route handlers
frontend/       React application
ml-service/     FastAPI ML workloads
nginx/          Reverse proxy config for Compose
```

## Operations notes

- **Migrations**: Applied on Django container start; for manual runs use `python manage.py migrate` in `backend/`.
- **Background work**: In Compose, the Django service runs Kafka consumers and Celery when `RUN_KAFKA_CONSUMERS` and `RUN_CELERY` are enabled.
- **Kafka topics**: `raw-match-events`, `normalized-match-events` (auto-created when broker allows).
- **Security**: Never commit `.env`; rotate JWT and encryption keys for any shared or production deployment.

## License

See repository license file if present; otherwise treat as private project material.
