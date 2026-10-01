import logging
from datetime import datetime, timezone

import httpx
from django.conf import settings

from apps.accounts.models import UserGameAccount
from apps.games.models import ApiFetchLog, Game
from apps.ingestion.kafka import build_raw_message, publish_raw_match
from apps.ingestion.errors import IngestionError
from apps.ingestion.strategies import SLUG_TO_ID, get_strategy

logger = logging.getLogger(__name__)


def _log_fetch(game_id, fetch_type, status, records, metadata=None):
    ApiFetchLog.objects.create(
        game_id=game_id,
        fetch_type=fetch_type,
        status=status,
        records_fetched=records,
        fetched_at=datetime.now(timezone.utc),
        metadata=metadata or {},
    )


def _publish_matches(game_id, game_slug, matches, fetch_type, user_id=None):
    external_ids = []
    for match in matches:
        msg = build_raw_message(game_id, game_slug, match, fetch_type, user_id)
        publish_raw_match(msg)
        external_ids.append(match["externalMatchId"])

    status = "SUCCESS" if matches else "PARTIAL"
    if not matches:
        status = "FAILED"
    _log_fetch(game_id, fetch_type, status, len(matches), {"externalMatchIds": external_ids})
    return {
        "gameId": game_id,
        "matchesIngested": len(matches),
        "externalMatchIds": external_ids,
        "triggeredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": fetch_type,
        "message": f"Ingested {len(matches)} matches",
    }


def trigger_ingestion(data):
    user_id = data.get("userId")
    if not user_id:
        raise IngestionError(
            "userId is required. Match ingestion only runs for a user's linked game accounts.",
            "USER_ID_REQUIRED",
        )
    game_id = int(data["gameId"])
    limit = min(int(data.get("limit", 5)), 50)
    return sync_user_matches(int(user_id), game_id, limit)


def trigger_single_match(data):
    game_id = int(data["gameId"])
    external_match_id = data["externalMatchId"]
    strategy = get_strategy(game_id)
    match = strategy.fetch_match_by_id(external_match_id)
    return _publish_matches(game_id, strategy.game_slug, [match], "MANUAL_SINGLE")


def trigger_game_ingestion(game_slug, limit=5, user_id=None):
    if user_id is None:
        raise IngestionError(
            "userId is required. Match ingestion only runs for a user's linked game accounts.",
            "USER_ID_REQUIRED",
        )
    game_id = SLUG_TO_ID.get(game_slug)
    if not game_id:
        raise ValueError(f"Unknown game slug: {game_slug}")
    limit = min(limit, 50)
    return sync_user_matches(int(user_id), game_id, limit)


def _as_ingestion_error(game_id, exc):
    if isinstance(exc, IngestionError):
        return exc
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (401, 403) and game_id == 2:
            return IngestionError(
                "Faceit API key is invalid or missing. Update FACEIT_API_KEY in .env and restart the backend.",
                "FACEIT_API_KEY_INVALID",
            )
        if status == 401 and game_id == 3:
            return IngestionError(
                "Riot API key rejected (HTTP 401). Update RIOT_API_KEY in .env with a fresh "
                "development key or your Personal product key, then: docker compose up -d django-backend",
                "RIOT_API_KEY_INVALID",
            )
        if status == 403 and game_id == 3:
            return IngestionError(
                "Valorant match history is not allowed for this API key (HTTP 403). "
                "Register a Personal API key for your app at developer.riotgames.com and use that key in RIOT_API_KEY.",
                "RIOT_VALORANT_API_FORBIDDEN",
            )
        if status == 401:
            return IngestionError(
                "Riot API key rejected (HTTP 401). Update RIOT_API_KEY in .env and restart the backend.",
                "RIOT_API_KEY_INVALID",
            )
        if status == 403:
            return IngestionError(
                "Riot API key is invalid, expired, or missing product access. Update RIOT_API_KEY in .env.",
                "RIOT_API_KEY_INVALID",
            )
        if status == 404:
            return IngestionError(
                "No recent matches found for this account on the provider API.",
                "MATCHES_NOT_FOUND",
            )
        return IngestionError(f"Provider API error ({status}).", "PROVIDER_API_ERROR")
    return IngestionError(str(exc), "INGESTION_ERROR")


def _ingestion_error_message(game_id, exc):
    return _as_ingestion_error(game_id, exc).message


def sync_user_matches(user_id, game_id=None, limit=5):
    limit = min(limit, 50)
    accounts = UserGameAccount.objects.filter(user_id=user_id)
    if game_id:
        accounts = accounts.filter(game_id=game_id)

    total = 0
    games_result = []
    errors = []
    account_list = list(accounts.select_related("game"))
    if not account_list:
        raise IngestionError(
            "No linked game accounts. Link Riot ID, Faceit, Steam, or other profiles in settings.",
            "PLAYER_NOT_LINKED",
        )

    for account in account_list:
        ctx = {
            "external_player_id": account.external_player_id,
            "metadata": account.metadata,
        }
        try:
            strategy = get_strategy(account.game_id, ctx)
            matches = strategy.fetch_recent_matches(ctx, limit)
        except Exception as exc:
            ing = _as_ingestion_error(account.game_id, exc)
            logger.warning(
                "Match sync failed for user=%s game=%s: %s",
                user_id,
                account.game_id,
                ing.message,
                exc_info=True,
            )
            _log_fetch(account.game_id, "MANUAL_USER_SYNC", "FAILED", 0, {"error": ing.message, "code": ing.code})
            errors.append({"gameId": account.game_id, "error": ing.message, "code": ing.code})
            continue

        if matches:
            result = _publish_matches(account.game_id, strategy.game_slug, matches, "MANUAL_USER_SYNC", user_id)
            total += result["matchesIngested"]
            games_result.append({
                "gameId": account.game_id,
                "matchesIngested": result["matchesIngested"],
                "externalMatchIds": result["externalMatchIds"],
            })
            account.last_match_external_id = matches[0]["externalMatchId"]
            account.last_polled_at = datetime.now(timezone.utc)
            account.save(update_fields=["last_match_external_id", "last_polled_at", "updated_at"])
        else:
            _log_fetch(account.game_id, "MANUAL_USER_SYNC", "PARTIAL", 0, {"message": "No matches returned"})
            games_result.append({
                "gameId": account.game_id,
                "matchesIngested": 0,
                "externalMatchIds": [],
            })

    if total == 0 and errors and len(errors) >= len(account_list):
        first = errors[0]
        raise IngestionError(first["error"], first.get("code", "INGESTION_ERROR"))

    return {
        "matchesIngested": total,
        "accountsSynced": len(account_list),
        "games": games_result,
        "errors": errors,
        "syncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "message": f"Synced {total} matches across {len(account_list)} accounts",
    }


def get_fetch_logs(game_id=None, limit=10):
    qs = ApiFetchLog.objects.select_related("game").order_by("-fetched_at")
    if game_id:
        qs = qs.filter(game_id=game_id)
    return [
        {
            "gameId": log.game_id,
            "gameSlug": log.game.slug,
            "fetchType": log.fetch_type,
            "status": log.status,
            "recordsFetched": log.records_fetched,
            "fetchedAt": log.fetched_at.isoformat().replace("+00:00", "Z"),
            "metadata": log.metadata,
        }
        for log in qs[:limit]
    ]


def get_scheduler_info():
    return {
        "enabled": True,
        "cron": settings.TIKITAKA_INGESTION_CRON,
        "nextRunEstimate": None,
        "gameIds": settings.INGESTION_GAME_IDS,
        "defaultLimit": settings.INGESTION_DEFAULT_LIMIT,
        "minIntervalSeconds": 60,
    }


def run_scheduled_ingestion():
    """Sync linked user accounts only (no env seed / public match fallbacks)."""
    user_ids = (
        UserGameAccount.objects.exclude(external_player_id="")
        .values_list("user_id", flat=True)
        .distinct()
    )
    for user_id in user_ids:
        try:
            sync_user_matches(user_id, limit=settings.INGESTION_DEFAULT_LIMIT)
        except IngestionError as exc:
            logger.warning("Scheduled ingestion skipped for user=%s: %s", user_id, exc.message)
        except Exception:
            logger.exception("Scheduled ingestion failed for user=%s", user_id)


def poll_user_matches():
    accounts = UserGameAccount.objects.exclude(external_player_id="").select_related("game")
    for account in accounts:
        ctx = {"external_player_id": account.external_player_id, "metadata": account.metadata}
        try:
            strategy = get_strategy(account.game_id, ctx)
            matches = strategy.fetch_recent_matches(ctx, 1)
            if matches and matches[0]["externalMatchId"] != account.last_match_external_id:
                _publish_matches(account.game_id, strategy.game_slug, matches, "USER_POLLER", account.user_id)
                account.last_match_external_id = matches[0]["externalMatchId"]
                account.last_polled_at = datetime.now(timezone.utc)
                account.save(update_fields=["last_match_external_id", "last_polled_at", "updated_at"])
        except Exception as exc:
            logger.warning(
                "User match poller failed for user=%s game=%s: %s",
                account.user_id,
                account.game_id,
                _ingestion_error_message(account.game_id, exc),
                exc_info=True,
            )
