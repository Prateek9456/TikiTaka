# TikiTaka AI (Django Backend)

Django port of the TikiTaka AI platform. Same frontend, ML service, database schema, and API contracts as the original Spring Boot version — only the backend framework changed.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12, Django 5, Django REST Framework |
| Frontend | React + Vite (unchanged) |
| ML Service | Python FastAPI (unchanged) |
| Database | MySQL 8 |
| Cache / OAuth state | Redis 7 |
| Message broker | Kafka (Confluent 7.5) |
| Task scheduler | Celery + django-celery-beat |
| Reverse proxy | Nginx |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your API keys and OAuth credentials

docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Django API | http://localhost:8080/api/v1 |
| ML Service | http://localhost:8000 |
| Health check | http://localhost:8080/actuator/health |

## Local Development (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start MySQL, Redis, Kafka via docker compose up mysql redis kafka zookeeper

python manage.py migrate
python manage.py runserver 8080
```

## API Compatibility

All endpoints match the Spring Boot API at `/api/v1`:

- **Auth**: register, login, logout, JWT, CSRF, forgot/reset password
- **OAuth**: Google, Riot, Steam, Faceit, Epic (login + account linking)
- **Games & Patterns**: public read endpoints
- **Matches**: latest match analysis, leaderboard
- **Sessions**: auth and game session history
- **Ingestion**: manual triggers, user sync, scheduler status

Response envelope: `{ success, message?, data, error?, timestamp }`

## Project Structure

```
backend/
  tikitaka/          # Django project settings
  apps/
    core/            # JWT, CSRF middleware, API responses
    accounts/        # User, OAuth, password reset
    games/           # Games, players, patterns
    matches/         # Matches, events, scores
    ingestion/       # Game API clients, Kafka producer, schedulers
    processing/      # Match normalization, Kafka consumer
    analytics/       # ML integration, pattern detection
    api/             # REST endpoint views
frontend/            # React SPA (unchanged)
ml-service/          # Python ML service (unchanged)
```

## Environment Variables

See `.env.example` for the full list. Key variables:

- `JWT_SECRET` — base64-encoded HMAC key (min 256 bits)
- `OAUTH_TOKEN_ENCRYPTION_KEY` — base64 AES-256 key for provider tokens
- `*_CLIENT_ID/SECRET/REDIRECT_URI` — per OAuth provider
- `RIOT_API_KEY`, `FACEIT_API_KEY` — game API keys for ingestion
- `KAFKA_ENABLED` — set `false` for synchronous in-process pipeline

## Migration from Spring Boot

This repo is a drop-in replacement for the Java backend:

1. Same MySQL schema (Django migrations recreate Flyway tables)
2. Same JWT format (email subject, `ROLE_*` authorities)
3. Same BCrypt password hashes
4. Same OAuth redirect URLs and cookie names
5. Same Kafka topics: `raw-match-events`, `normalized-match-events`

The existing React frontend works without changes.
