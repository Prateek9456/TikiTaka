"""Tests for Markov chain pattern detection."""

from engines.markov import detect_patterns, event_to_state
from schemas import DetectPatternsRequest, EventPayload


def test_event_to_state_with_zone():
    event = EventPayload(
        type="kill",
        timestampMs=1000,
        actor="p1",
        metadata={"zone": "A"},
    )
    assert event_to_state(event) == "KILL:A"


def test_detect_kill_streak():
    request = DetectPatternsRequest(
        gameId=1,
        matchId=100,
        events=[
            EventPayload(type="KILL", timestampMs=1000, actor="p1", metadata={"zone": "A"}),
            EventPayload(type="KILL", timestampMs=5000, actor="p1", metadata={"zone": "A"}),
        ],
    )
    patterns = detect_patterns(request)
    slugs = {p.pattern_slug for p in patterns}
    assert "kill-streak" in slugs or "a-site-rush" in slugs


def test_detect_a_site_rush():
    request = DetectPatternsRequest(
        gameId=1,
        matchId=101,
        events=[
            EventPayload(type="KILL", timestampMs=10_000, actor="p1", metadata={"zone": "A"}),
            EventPayload(type="KILL", timestampMs=15_000, actor="p2", metadata={"zone": "A"}),
            EventPayload(type="ROUND_END", timestampMs=40_000, actor=None, metadata={"round": 1}),
        ],
    )
    patterns = detect_patterns(request)
    assert len(patterns) >= 1
    assert all(0.0 < p.confidence <= 1.0 for p in patterns)
    assert all(p.start_ts <= p.end_ts for p in patterns)


def test_empty_events_returns_empty():
    request = DetectPatternsRequest(gameId=1, matchId=102, events=[])
    assert detect_patterns(request) == []
