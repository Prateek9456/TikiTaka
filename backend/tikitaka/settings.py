"""Django settings for TikiTaka AI backend."""

import base64
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-tikitaka-dev-only-change-in-production",
)

DEBUG = os.environ.get("DEBUG", "false").lower() in ("1", "true", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1,django-backend").split(",")
    if h.strip()
]
for _host_env in ("WEB_HOSTNAME", "RENDER_EXTERNAL_HOSTNAME"):
    _host = os.environ.get(_host_env, "").strip()
    if _host and _host not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(_host)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_celery_beat",
    "apps.core",
    "apps.accounts",
    "apps.games",
    "apps.matches",
    "apps.ingestion",
    "apps.processing",
    "apps.analytics",
    "apps.api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.core.middleware.SpaCsrfMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.JwtAuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "tikitaka.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "tikitaka.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("MYSQL_DATABASE", "tikitaka"),
        "USER": os.environ.get("MYSQL_USER", "tikitaka"),
        "PASSWORD": os.environ.get("MYSQL_PASSWORD", "tikitaka_secret"),
        "HOST": os.environ.get("MYSQL_HOST", "localhost"),
        "PORT": os.environ.get("MYSQL_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

_cloud_sql = os.environ.get("CLOUD_SQL_CONNECTION_NAME", "").strip()
if _cloud_sql:
    DATABASES["default"]["HOST"] = f"/cloudsql/{_cloud_sql}"
    DATABASES["default"]["PORT"] = ""

AUTH_USER_MODEL = "accounts.User"


def _redis_connection_url(db_index: int) -> str:
    dedicated = os.environ.get(f"REDIS_URL_{db_index}", "").strip()
    if dedicated:
        return dedicated
    base = os.environ.get("REDIS_URL", "").strip()
    if base:
        trimmed = base.rstrip("/")
        tail = trimmed.rsplit("/", 1)[-1]
        if tail.isdigit():
            return f"{trimmed.rsplit('/', 1)[0]}/{db_index}"
        return f"{trimmed}/{db_index}"
    password = os.environ.get("REDIS_PASSWORD", "")
    auth = f":{password}@" if password else ""
    host = os.environ.get("REDIS_HOST", "localhost")
    port = os.environ.get("REDIS_PORT", "6379")
    use_tls = os.environ.get("REDIS_SSL", "").lower() in ("1", "true", "yes")
    scheme = "rediss" if use_tls else "redis"
    return f"{scheme}://{auth}{host}:{port}/{db_index}"


def _redis_client_options() -> dict:
    options: dict = {"CLIENT_CLASS": "django_redis.client.DefaultClient"}
    redis_url = os.environ.get("REDIS_URL", "")
    use_tls = os.environ.get("REDIS_SSL", "").lower() in ("1", "true", "yes")
    if redis_url.startswith("rediss://") or use_tls:
        options["CONNECTION_POOL_KWARGS"] = {"ssl_cert_reqs": None}
    password = os.environ.get("REDIS_PASSWORD")
    if password and not redis_url:
        options["PASSWORD"] = password
    return options


_REDIS_LOCATION = _redis_connection_url(0)
_REDIS_OPTIONS = _redis_client_options()


def _redis_cache(key_prefix: str, timeout: int) -> dict:
    return {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": _REDIS_LOCATION,
        "OPTIONS": _REDIS_OPTIONS,
        "KEY_PREFIX": key_prefix,
        "TIMEOUT": timeout,
    }


CACHES = {
    "default": _redis_cache("tikitaka", 900),
    "games": _redis_cache("tikitaka:games", 3600),
    "player_stats": _redis_cache("tikitaka:player_stats", 600),
    "match_analysis": _redis_cache("tikitaka:match_analysis", 1800),
    "patterns": _redis_cache("tikitaka:patterns", 1200),
    "team_patterns": _redis_cache("tikitaka:team_patterns", 1200),
    "leaderboard": _redis_cache("tikitaka:leaderboard", 300),
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# TikiTaka application settings
# ---------------------------------------------------------------------------

JWT_SECRET = os.environ.get(
    "JWT_SECRET",
    "VGhpc0lzQVNlY3VyZUtleUZvclRpa2lUYWthQWlKd3RUb2tlbkVuY29kaW5nMTIzNDU2Nzg=",
)
JWT_EXPIRATION_MS = int(os.environ.get("JWT_EXPIRATION_MS", "86400000"))
JWT_ALGORITHM = "HS256"

OAUTH_TOKEN_ENCRYPTION_KEY = os.environ.get("OAUTH_TOKEN_ENCRYPTION_KEY", "")

PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "").rstrip("/")


def _origin_url(env_key: str, path_suffix: str, local_default: str) -> str:
    override = os.environ.get(env_key, "").strip()
    if override:
        return override
    if PUBLIC_APP_URL:
        return f"{PUBLIC_APP_URL}{path_suffix}"
    return local_default


OAUTH_FRONTEND_REDIRECT_URL = _origin_url(
    "OAUTH_FRONTEND_REDIRECT_URL", "/auth/callback", "http://localhost/auth/callback"
)
OAUTH_LINK_REDIRECT_URL = _origin_url(
    "OAUTH_LINK_REDIRECT_URL", "/settings/accounts", "http://localhost/settings/accounts"
)
OAUTH_FRONTEND_LOGIN_URL = _origin_url(
    "OAUTH_FRONTEND_LOGIN_URL", "/login", "http://localhost/login"
)

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "Lax")

CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://localhost",
    ).split(",")
    if o.strip()
]
if PUBLIC_APP_URL:
    CORS_ALLOWED_ORIGINS.append(PUBLIC_APP_URL)

if os.environ.get("CLOUD_RUN", "").lower() in ("1", "true", "yes") or os.environ.get(
    "RENDER", ""
).lower() in ("1", "true", "yes"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

USE_CELERY_TASKS = os.environ.get("USE_CELERY_TASKS", "true").lower() in ("1", "true", "yes")

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = ["*"]
CORS_EXPOSE_HEADERS = ["Authorization", "Location", "X-XSRF-TOKEN"]

CSRF_COOKIE_NAME = "XSRF-TOKEN"
CSRF_HEADER_NAME = "HTTP_X_XSRF_TOKEN"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_COOKIE_SECURE = COOKIE_SECURE
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

CSRF_EXEMPT_PATHS = (
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
)

# Email
EMAIL_HOST = os.environ.get("MAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("MAIL_USERNAME", "")
EMAIL_HOST_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("MAIL_FROM", "noreply@tikitaka.local")

# OAuth providers
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = _origin_url(
    "GOOGLE_REDIRECT_URI",
    "/api/v1/auth/oauth/google/callback",
    "http://localhost/api/v1/auth/oauth/google/callback",
)

RIOT_CLIENT_ID = os.environ.get("RIOT_CLIENT_ID", "")
RIOT_CLIENT_SECRET = os.environ.get("RIOT_CLIENT_SECRET", "")
RIOT_REDIRECT_URI = _origin_url(
    "RIOT_REDIRECT_URI",
    "/api/v1/auth/oauth/riot/callback",
    "http://localhost/api/v1/auth/oauth/riot/callback",
)
RIOT_DEFAULT_REGION = os.environ.get("RIOT_DEFAULT_REGION", "americas")
VALORANT_SHARD = os.environ.get("VALORANT_SHARD", "")
def _load_riot_api_key():
    from apps.ingestion.riot_keys import normalize_riot_api_key

    return normalize_riot_api_key(os.environ.get("RIOT_API_KEY", ""))


RIOT_API_KEY = _load_riot_api_key()

FACEIT_CLIENT_ID = os.environ.get("FACEIT_CLIENT_ID", "")
FACEIT_CLIENT_SECRET = os.environ.get("FACEIT_CLIENT_SECRET", "")
FACEIT_REDIRECT_URI = _origin_url(
    "FACEIT_REDIRECT_URI",
    "/api/v1/auth/oauth/faceit/callback",
    "http://localhost/api/v1/auth/oauth/faceit/callback",
)
FACEIT_API_KEY = os.environ.get("FACEIT_API_KEY", "")

STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")
STEAM_REALM = _origin_url("STEAM_REALM", "", "http://localhost")
STEAM_REDIRECT_URI = _origin_url(
    "STEAM_REDIRECT_URI",
    "/api/v1/auth/oauth/steam/callback",
    "http://localhost/api/v1/auth/oauth/steam/callback",
)

EPIC_CLIENT_ID = os.environ.get("EPIC_CLIENT_ID", "")
EPIC_CLIENT_SECRET = os.environ.get("EPIC_CLIENT_SECRET", "")
EPIC_REDIRECT_URI = _origin_url(
    "EPIC_REDIRECT_URI",
    "/api/v1/auth/oauth/epic/callback",
    "http://localhost/api/v1/auth/oauth/epic/callback",
)
EPIC_DEPLOYMENT_ID = os.environ.get("EPIC_DEPLOYMENT_ID", "")

# Ingestion
KAFKA_ENABLED = os.environ.get("KAFKA_ENABLED", "true").lower() in ("1", "true", "yes")
KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8000")

INGESTION_GAME_IDS = [1, 2, 3, 4]
INGESTION_DEFAULT_LIMIT = 20
TIKITAKA_INGESTION_CRON = os.environ.get("TIKITAKA_INGESTION_CRON", "0 */2 * * * *")
TIKITAKA_USER_POLLER_CRON = os.environ.get("TIKITAKA_USER_POLLER_CRON", "0 */1 * * * *")

GAME_SLUGS = {1: "dota2", 2: "cs2", 3: "valorant", 4: "lol"}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "apps.core.exceptions.tikitaka_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# Celery
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL") or _redis_connection_url(1)
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND") or CELERY_BROKER_URL
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
