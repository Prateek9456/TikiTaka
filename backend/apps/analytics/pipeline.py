import logging
from datetime import datetime, timezone
from decimal import Decimal

from apps.analytics.ml_client import MlServiceClient
from apps.games.models import Player, TacticalPattern
from apps.matches.models import Match, MatchEvent, MatchPatternOccurrence, MatchParticipant, PlayerPerformanceScore

logger = logging.getLogger(__name__)


def detect_and_persist_patterns(match_id, game_id):
    MatchPatternOccurrence.objects.filter(match_id=match_id).delete()
    events = list(MatchEvent.objects.filter(match_id=match_id).order_by("timestamp_ms"))
    if not events:
        return []

    client = MlServiceClient()
    try:
        response = client.detect_patterns(game_id, match_id, events)
    except Exception as exc:
        logger.warning("ML pattern detection failed for match %s: %s", match_id, exc)
        return []

    occurrences = []
    for detected in response.get("patterns", []):
        slug = detected.get("patternSlug")
        pattern, _ = TacticalPattern.objects.get_or_create(
            game_id=game_id,
            pattern_slug=slug,
            defaults={
                "pattern_name": slug,
                "description": "Auto-detected pattern",
                "sample_size": 0,
            },
        )
        occ = MatchPatternOccurrence.objects.create(
            match_id=match_id,
            pattern=pattern,
            timestamp_ms=detected.get("startTs", 0),
            confidence_score=Decimal(str(detected.get("confidence", 0))).quantize(Decimal("0.0001")),
        )
        occurrences.append(occ)
    return occurrences


def score_players(match_id, game_id, pattern_slugs):
    events = MatchEvent.objects.filter(match_id=match_id).order_by("timestamp_ms")
    event_payload = [
        {"type": e.event_type, "timestampMs": e.timestamp_ms, "actor": e.actor_id, "metadata": e.metadata or {}}
        for e in events
    ]

    actor_ids = set(e.actor_id for e in events if e.actor_id)
    participants = MatchParticipant.objects.filter(match_id=match_id).select_related("player")
    player_ids = {p.player.external_player_id: p.player_id for p in participants}

    client = MlServiceClient()
    for actor_id in actor_ids:
        player_id = player_ids.get(actor_id)
        if not player_id:
            player, _ = Player.objects.get_or_create(
                game_id=game_id,
                external_player_id=actor_id,
                defaults={"username": actor_id[:32]},
            )
            player_id = player.id

        try:
            response = client.score_player(
                game_id,
                player_id,
                match_id,
                event_payload,
                {"detected_patterns": pattern_slugs, "team_side": "unknown"},
            )
            PlayerPerformanceScore.objects.create(
                player_id=player_id,
                match_id=match_id,
                score=Decimal(str(response.get("tikitakaScore", 0))).quantize(Decimal("0.0001")),
                computed_at=datetime.now(timezone.utc),
            )
        except Exception as exc:
            logger.warning("ML scoring failed for player %s match %s: %s", player_id, match_id, exc)


def process_normalized_match_in_process(normalized_event: dict):
    if normalized_event.get("eventType") != "MATCH_PROCESSED":
        return

    match_id = normalized_event["matchId"]
    game_id = normalized_event["gameId"]

    occurrences = detect_and_persist_patterns(match_id, game_id)
    pattern_slugs = [o.pattern.pattern_slug for o in occurrences]
    score_players(match_id, game_id, pattern_slugs)
