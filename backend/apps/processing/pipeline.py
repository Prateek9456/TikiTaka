import logging
from datetime import datetime, timezone

from apps.games.models import Game
from apps.ingestion.kafka import publish_normalized_match
from apps.matches.models import Match, MatchEvent, UserMatch

logger = logging.getLogger(__name__)


def normalize_and_persist(raw_event: dict):
    game_id = raw_event["gameId"]
    external_match_id = raw_event["externalMatchId"]

    game = Game.objects.filter(id=game_id).first()
    if not game:
        raise ValueError(f"Game not found: {game_id}")

    played_at = raw_event.get("playedAt")
    if isinstance(played_at, str):
        played_at = datetime.fromisoformat(played_at.replace("Z", "+00:00"))

    match, created = Match.objects.update_or_create(
        game_id=game_id,
        external_match_id=external_match_id,
        defaults={
            "played_at": played_at or datetime.now(timezone.utc),
            "duration_seconds": raw_event.get("durationSeconds"),
            "patch_version": raw_event.get("patchVersion"),
            "raw_data": raw_event.get("payload"),
        },
    )

    if not created:
        MatchEvent.objects.filter(match=match).delete()

    for ev in raw_event.get("events", []):
        MatchEvent.objects.create(
            match=match,
            event_type=ev.get("eventType", ev.get("event_type", "UNKNOWN")),
            timestamp_ms=ev.get("timestampMs", ev.get("timestamp_ms", 0)),
            actor_id=ev.get("actorId", ev.get("actor_id")),
            target_id=ev.get("targetId", ev.get("target_id")),
            metadata=ev.get("metadata"),
        )

    user_id = raw_event.get("userId")
    if user_id:
        fetch_type = raw_event.get("fetchType", "INGESTION")
        source = "USER_POLLER" if fetch_type == "USER_POLLER" else "MANUAL_SYNC"
        UserMatch.objects.get_or_create(
            user_id=user_id,
            match=match,
            game_id=game_id,
            defaults={
                "source": source,
                "ingested_at": datetime.now(timezone.utc),
            },
        )

    normalized = {
        "gameId": game_id,
        "matchId": match.id,
        "externalMatchId": external_match_id,
        "eventType": "MATCH_PROCESSED",
        "timestampMs": int(datetime.now(timezone.utc).timestamp() * 1000),
        "actorId": None,
        "targetId": None,
        "metadata": raw_event.get("payload", {}),
    }
    publish_normalized_match(normalized)
    return match


def process_raw_match_in_process(raw_event: dict):
    normalize_and_persist(raw_event)
