import json
import logging
from datetime import datetime, timezone

from django.conf import settings

logger = logging.getLogger(__name__)

RAW_TOPIC = "raw-match-events"
NORMALIZED_TOPIC = "normalized-match-events"


def _get_producer():
    if not settings.KAFKA_ENABLED:
        return None
    from confluent_kafka import Producer

    return Producer({"bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS})


def publish_raw_match(message: dict):
    if not settings.KAFKA_ENABLED:
        from apps.processing.pipeline import process_raw_match_in_process

        process_raw_match_in_process(message)
        return

    producer = _get_producer()
    if not producer:
        return

    key = message.get("externalMatchId", "")
    producer.produce(RAW_TOPIC, key=key, value=json.dumps(message, default=str))
    producer.flush()
    logger.info("Published raw match event: %s", key)


def publish_normalized_match(message: dict):
    if not settings.KAFKA_ENABLED:
        from apps.analytics.pipeline import process_normalized_match_in_process

        process_normalized_match_in_process(message)
        return

    producer = _get_producer()
    if not producer:
        return

    key = message.get("externalMatchId", "")
    producer.produce(NORMALIZED_TOPIC, key=key, value=json.dumps(message, default=str))
    producer.flush()


def build_raw_message(game_id, game_slug, match_data, fetch_type, user_id=None):
    return {
        "gameId": game_id,
        "gameSlug": game_slug,
        "externalMatchId": match_data["externalMatchId"],
        "userId": user_id,
        "fetchType": fetch_type,
        "payload": match_data.get("payload", {}),
        "events": match_data.get("events", []),
        "playedAt": match_data.get("playedAt", datetime.now(timezone.utc).isoformat()),
        "durationSeconds": match_data.get("durationSeconds", 0),
        "patchVersion": match_data.get("patchVersion", ""),
    }
