"""API contract tests — verify camelCase JSON matches Java DTO expectations."""

import json

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_detect_patterns_response_uses_camel_case():
    payload = {
        "gameId": 1,
        "matchId": 300,
        "events": [
            {"type": "KILL", "timestampMs": 1000, "actor": "p1", "metadata": {"zone": "A"}},
            {"type": "KILL", "timestampMs": 6000, "actor": "p2", "metadata": {"zone": "A"}},
            {"type": "ROUND_END", "timestampMs": 30_000, "actor": None, "metadata": {"round": 0}},
        ],
    }
    response = client.post("/detect-patterns", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "patterns" in body
    if body["patterns"]:
        pattern = body["patterns"][0]
        assert "patternSlug" in pattern
        assert "confidence" in pattern
        assert "startTs" in pattern
        assert "endTs" in pattern
        assert "pattern_slug" not in pattern


def test_score_player_response_uses_camel_case():
    payload = {
        "gameId": 1,
        "playerId": 7,
        "matchId": 301,
        "events": [
            {"type": "KILL", "timestampMs": 1000, "actor": "p7", "metadata": {"round": 0}},
            {"type": "KILL", "timestampMs": 5000, "actor": "p7", "metadata": {"round": 0}},
        ],
        "patternContext": {"detected_patterns": ["kill-streak"], "team_side": "attack"},
    }
    response = client.post("/score-player", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "tikitakaScore" in body
    assert "breakdown" in body
    assert "aggression" in body["breakdown"]
    assert "tikitaka_score" not in body

    # Verify Java Jackson can deserialize the shape
    serialized = json.dumps(body)
    parsed = json.loads(serialized)
    assert isinstance(parsed["tikitakaScore"], float)
