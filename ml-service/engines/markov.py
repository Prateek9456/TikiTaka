"""Markov chain engine for tactical pattern detection from match event sequences."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from schemas import DetectedPattern, DetectPatternsRequest, EventPayload

# Tactical pattern templates — each is a state sequence the Markov engine matches.
PATTERN_TEMPLATES: list[tuple[str, list[str], int]] = [
    ("kill-streak", ["KILL", "KILL"], 15_000),
    ("triple-elimination", ["KILL", "KILL", "KILL"], 25_000),
    ("a-site-rush", ["KILL:A", "KILL:A"], 20_000),
    ("b-site-rush", ["KILL:B", "KILL:B"], 20_000),
    ("objective-push", ["OBJECTIVE", "KILL"], 30_000),
    ("kill-then-objective", ["KILL", "OBJECTIVE"], 30_000),
    ("round-dominance", ["KILL", "KILL", "ROUND_END"], 45_000),
    ("aggressive-opening", ["KILL", "KILL", "ASSIST"], 20_000),
    ("team-fight", ["KILL", "ASSIST", "KILL"], 25_000),
    ("defensive-hold", ["DEATH", "KILL", "ROUND_END"], 40_000),
]

SMOOTHING_ALPHA = 0.5


@dataclass(frozen=True)
class AnnotatedEvent:
    state: str
    timestamp_ms: int
    index: int


def _normalize_zone(metadata: dict | None) -> str | None:
    if not metadata:
        return None
    for key in ("zone", "site", "location", "area"):
        value = metadata.get(key)
        if value is not None:
            return str(value).upper().replace(" ", "-")
    return None


def event_to_state(event: EventPayload) -> str:
    event_type = (event.type or "UNKNOWN").upper()
    zone = _normalize_zone(event.metadata)
    if zone:
        return f"{event_type}:{zone}"
    return event_type


def build_annotated_sequence(events: list[EventPayload]) -> list[AnnotatedEvent]:
    sorted_events = sorted(events, key=lambda e: e.timestamp_ms)
    return [
        AnnotatedEvent(state=event_to_state(event), timestamp_ms=event.timestamp_ms, index=i)
        for i, event in enumerate(sorted_events)
    ]


class MarkovChain:
    """First-order Markov chain built from observed event-state transitions."""

    def __init__(self) -> None:
        self._transition_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self._state_counts: dict[str, int] = defaultdict(int)

    def fit(self, states: list[str]) -> None:
        for i in range(len(states) - 1):
            current, nxt = states[i], states[i + 1]
            self._transition_counts[current][nxt] += 1
            self._state_counts[current] += 1

    def transition_probability(self, from_state: str, to_state: str) -> float:
        outgoing = self._transition_counts.get(from_state, {})
        total = self._state_counts.get(from_state, 0)
        numerator = outgoing.get(to_state, 0) + SMOOTHING_ALPHA
        denominator = total + SMOOTHING_ALPHA * max(len(outgoing) + 1, 2)
        return numerator / denominator

    def path_confidence(self, states: list[str]) -> float:
        if len(states) < 2:
            return 0.5
        probs = [
            self.transition_probability(states[i], states[i + 1])
            for i in range(len(states) - 1)
        ]
        # Geometric mean keeps confidence in (0, 1] while penalising weak links.
        product = 1.0
        for prob in probs:
            product *= prob
        return min(1.0, product ** (1.0 / len(probs)))


def _states_within_window(
    annotated: list[AnnotatedEvent],
    start_idx: int,
    template: list[str],
    max_gap_ms: int,
) -> tuple[list[int], float] | None:
    """Find template states starting at start_idx within the time window."""
    if annotated[start_idx].state != template[0]:
        return None

    matched_indices = [start_idx]
    search_from = start_idx + 1

    for template_state in template[1:]:
        found = False
        for j in range(search_from, len(annotated)):
            candidate = annotated[j]
            if candidate.timestamp_ms - annotated[start_idx].timestamp_ms > max_gap_ms:
                break
            if candidate.state == template_state:
                matched_indices.append(j)
                search_from = j + 1
                found = True
                break
        if not found:
            return None

    return matched_indices, 1.0


def detect_patterns(request: DetectPatternsRequest) -> list[DetectedPattern]:
    if not request.events:
        return []

    annotated = build_annotated_sequence(request.events)
    states = [entry.state for entry in annotated]
    chain = MarkovChain()
    chain.fit(states)

    detections: list[DetectedPattern] = []
    seen_spans: set[tuple[str, int, int]] = set()

    for template_slug, template_states, max_gap_ms in PATTERN_TEMPLATES:
        for start_idx in range(len(annotated)):
            match = _states_within_window(annotated, start_idx, template_states, max_gap_ms)
            if match is None:
                continue

            matched_indices, _ = match
            start_ts = annotated[matched_indices[0]].timestamp_ms
            end_ts = annotated[matched_indices[-1]].timestamp_ms
            span_key = (template_slug, start_ts, end_ts)
            if span_key in seen_spans:
                continue
            seen_spans.add(span_key)

            matched_states = [annotated[i].state for i in matched_indices]
            confidence = round(chain.path_confidence(matched_states), 4)

            if confidence < 0.05:
                continue

            detections.append(
                DetectedPattern(
                    pattern_slug=template_slug,
                    confidence=confidence,
                    start_ts=start_ts,
                    end_ts=end_ts,
                )
            )

    detections.sort(key=lambda p: (-p.confidence, p.start_ts))
    return _deduplicate_overlapping(detections)


def _deduplicate_overlapping(patterns: list[DetectedPattern]) -> list[DetectedPattern]:
    """Keep highest-confidence pattern when two detections overlap heavily."""
    kept: list[DetectedPattern] = []
    for pattern in patterns:
        overlaps = False
        for existing in kept:
            if pattern.pattern_slug != existing.pattern_slug:
                continue
            overlap_start = max(pattern.start_ts, existing.start_ts)
            overlap_end = min(pattern.end_ts, existing.end_ts)
            span = max(pattern.end_ts - pattern.start_ts, 1)
            if overlap_end > overlap_start and (overlap_end - overlap_start) / span > 0.6:
                overlaps = True
                break
        if not overlaps:
            kept.append(pattern)
    return kept
