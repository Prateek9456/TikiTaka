import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class MlServiceClient:
    def __init__(self):
        self.base_url = settings.ML_SERVICE_URL.rstrip("/")
        self.timeout = 30.0

    def detect_patterns(self, game_id, match_id, events):
        payload = {
            "gameId": game_id,
            "matchId": match_id,
            "events": [
                {
                    "type": e.event_type,
                    "timestampMs": e.timestamp_ms,
                    "actor": e.actor_id,
                    "metadata": e.metadata or {},
                }
                for e in events
            ],
        }
        resp = httpx.post(f"{self.base_url}/detect-patterns", json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def score_player(self, game_id, player_id, match_id, events, pattern_context):
        payload = {
            "gameId": game_id,
            "playerId": player_id,
            "matchId": match_id,
            "events": events,
            "patternContext": pattern_context,
        }
        resp = httpx.post(f"{self.base_url}/score-player", json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()
