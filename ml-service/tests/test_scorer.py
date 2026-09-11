"""Tests for XGBoost player scoring."""

from engines.scorer import extract_features, score_player
from schemas import EventPayload, ScorePlayerRequest


def test_extract_features_basic():
    events = [
        EventPayload(type="KILL", timestampMs=1000, actor="p1", metadata={"round": 0}),
        EventPayload(type="KILL", timestampMs=5000, actor="p1", metadata={"round": 0}),
        EventPayload(type="DEATH", timestampMs=8000, actor="p1", metadata={"round": 0}),
    ]
    features = extract_features(events, {"detected_patterns": ["kill-streak"], "team_side": "attack"})
    assert features["kills"] == 2.0
    assert features["deaths"] == 1.0
    assert features["pattern_count"] == 1.0
    assert features["attack_side"] == 1.0


def test_score_player_returns_valid_range():
    request = ScorePlayerRequest(
        gameId=1,
        playerId=42,
        matchId=200,
        events=[
            EventPayload(type="KILL", timestampMs=1000, actor="p1", metadata={"round": 0}),
            EventPayload(type="KILL", timestampMs=4000, actor="p1", metadata={"round": 0}),
            EventPayload(type="ASSIST", timestampMs=6000, actor="p1", metadata={"round": 0}),
            EventPayload(type="DEATH", timestampMs=20_000, actor="p1", metadata={"round": 1}),
        ],
        patternContext={"detected_patterns": ["kill-streak"], "team_side": "attack"},
    )
    response = score_player(request)
    assert 0.0 <= response.tikitaka_score <= 1.0
    assert 0.0 <= response.breakdown.aggression <= 1.0
    assert 0.0 <= response.breakdown.positioning <= 1.0
    assert 0.0 <= response.breakdown.timing <= 1.0


def test_score_player_empty_events():
    request = ScorePlayerRequest(gameId=1, playerId=1, matchId=201, events=[])
    response = score_player(request)
    assert 0.0 <= response.tikitaka_score <= 1.0
