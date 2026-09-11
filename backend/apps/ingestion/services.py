from datetime import datetime, timezone

from django.conf import settings

from apps.accounts.models import UserGameAccount
from apps.games.models import ApiFetchLog, Game
from apps.ingestion.kafka import build_raw_message, publish_raw_match
from apps.ingestion.strategies import SLUG_TO_ID, get_strategy


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
    game_id = int(data["gameId"])
    limit = min(int(data.get("limit", 5)), 50)
    strategy = get_strategy(game_id)
    matches = strategy.fetch_recent_matches(limit=limit)
    return _publish_matches(game_id, strategy.game_slug, matches, "MANUAL_RECENT")


def trigger_single_match(data):
    game_id = int(data["gameId"])
    external_match_id = data["externalMatchId"]
    strategy = get_strategy(game_id)
    match = strategy.fetch_match_by_id(external_match_id)
    return _publish_matches(game_id, strategy.game_slug, [match], "MANUAL_SINGLE")


def trigger_game_ingestion(game_slug, limit=5):
    game_id = SLUG_TO_ID.get(game_slug)
    if not game_id:
        raise ValueError(f"Unknown game slug: {game_slug}")
    limit = min(limit, 50)
    strategy = get_strategy(game_id)
    matches = strategy.fetch_recent_matches(limit=limit)
    return _publish_matches(game_id, strategy.game_slug, matches, "MANUAL_RECENT")


def sync_user_matches(user_id, game_id=None, limit=5):
    limit = min(limit, 50)
    accounts = UserGameAccount.objects.filter(user_id=user_id)
    if game_id:
        accounts = accounts.filter(game_id=game_id)

    total = 0
    games_result = []
    for account in accounts.select_related("game"):
        ctx = {
            "external_player_id": account.external_player_id,
            "metadata": account.metadata,
        }
        strategy = get_strategy(account.game_id)
        matches = strategy.fetch_recent_matches(ctx, limit)
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

    return {
        "matchesIngested": total,
        "accountsSynced": accounts.count(),
        "games": games_result,
        "syncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "message": f"Synced {total} matches across {accounts.count()} accounts",
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
    for game_id in settings.INGESTION_GAME_IDS:
        try:
            strategy = get_strategy(game_id)
            matches = strategy.fetch_recent_matches(limit=settings.INGESTION_DEFAULT_LIMIT)
            _publish_matches(game_id, strategy.game_slug, matches, "SCHEDULED")
        except Exception:
            _log_fetch(game_id, "SCHEDULED", "FAILED", 0)


def poll_user_matches():
    accounts = UserGameAccount.objects.exclude(external_player_id="").select_related("game")
    for account in accounts:
        try:
            ctx = {"external_player_id": account.external_player_id, "metadata": account.metadata}
            strategy = get_strategy(account.game_id)
            matches = strategy.fetch_recent_matches(ctx, 1)
            if matches and matches[0]["externalMatchId"] != account.last_match_external_id:
                _publish_matches(account.game_id, strategy.game_slug, matches, "USER_POLLER", account.user_id)
                account.last_match_external_id = matches[0]["externalMatchId"]
                account.last_polled_at = datetime.now(timezone.utc)
                account.save(update_fields=["last_match_external_id", "last_polled_at", "updated_at"])
        except Exception:
            pass
