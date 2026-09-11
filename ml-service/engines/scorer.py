"""XGBoost-based player impact scoring engine."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import xgboost as xgb

from schemas import EventPayload, ScoreBreakdown, ScorePlayerRequest, ScorePlayerResponse

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODEL_DIR / "player_scorer.json"

FEATURE_NAMES = [
    "kills",
    "deaths",
    "assists",
    "objectives",
    "kill_death_ratio",
    "actions_per_minute",
    "pattern_count",
    "attack_side",
    "early_kill_ratio",
    "round_participation",
]

_BREAKDOWN_WEIGHTS = {
    "aggression": np.array([0.35, -0.10, 0.15, 0.05, 0.25, 0.10, 0.10, 0.05, 0.30, 0.05]),
    "positioning": np.array([0.05, -0.30, 0.10, 0.35, 0.10, 0.05, 0.15, 0.10, -0.05, 0.25]),
    "timing": np.array([0.10, -0.05, 0.20, 0.10, 0.10, 0.30, 0.10, 0.05, 0.25, 0.20]),
}


class PlayerScorer:
    def __init__(self) -> None:
        self._model: xgb.XGBRegressor | None = None

    @property
    def model(self) -> xgb.XGBRegressor:
        if self._model is None:
            self._model = self._load_or_train()
        return self._model

    def score(self, request: ScorePlayerRequest) -> ScorePlayerResponse:
        features = extract_features(request.events, request.pattern_context)
        feature_vector = np.array([features[name] for name in FEATURE_NAMES], dtype=np.float32)

        raw_score = float(self.model.predict(feature_vector.reshape(1, -1))[0])
        tikitaka_score = round(_clamp(raw_score), 4)

        breakdown = ScoreBreakdown(
            aggression=round(_breakdown_component(feature_vector, "aggression"), 4),
            positioning=round(_breakdown_component(feature_vector, "positioning"), 4),
            timing=round(_breakdown_component(feature_vector, "timing"), 4),
        )

        return ScorePlayerResponse(tikitaka_score=tikitaka_score, breakdown=breakdown)

    def _load_or_train(self) -> xgb.XGBRegressor:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        model = xgb.XGBRegressor(
            n_estimators=80,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            objective="reg:squarederror",
        )

        if MODEL_PATH.exists():
            try:
                model.load_model(MODEL_PATH)
                logger.info("Loaded XGBoost model from %s", MODEL_PATH)
                return model
            except Exception:
                logger.warning("Failed to load model at %s — retraining", MODEL_PATH)

        logger.info("Training XGBoost scorer on synthetic data")
        x_train, y_train = generate_synthetic_training_data(n_samples=2000)
        model.fit(x_train, y_train)
        model.save_model(MODEL_PATH)
        logger.info("Saved XGBoost model to %s", MODEL_PATH)
        return model


def extract_features(
    events: list[EventPayload],
    pattern_context: dict | None,
) -> dict[str, float]:
    if not events:
        return {name: 0.0 for name in FEATURE_NAMES}

    player_events = sorted(events, key=lambda e: e.timestamp_ms)
    type_counts: dict[str, int] = {}
    for event in player_events:
        event_type = (event.type or "UNKNOWN").upper()
        type_counts[event_type] = type_counts.get(event_type, 0) + 1

    kills = float(type_counts.get("KILL", 0))
    deaths = float(type_counts.get("DEATH", 0))
    assists = float(type_counts.get("ASSIST", 0))
    objectives = float(type_counts.get("OBJECTIVE", 0))

    duration_ms = max(player_events[-1].timestamp_ms - player_events[0].timestamp_ms, 1)
    duration_min = duration_ms / 60_000.0
    actions_per_minute = len(player_events) / max(duration_min, 0.1)

    kill_death_ratio = kills / max(deaths, 1.0)
    kill_death_ratio = min(kill_death_ratio, 5.0)

    pattern_count = 0.0
    attack_side = 0.0
    if pattern_context:
        detected = pattern_context.get("detected_patterns") or pattern_context.get("detectedPatterns") or []
        if isinstance(detected, list):
            pattern_count = float(len(detected))
        side = str(pattern_context.get("team_side") or pattern_context.get("teamSide") or "").lower()
        attack_side = 1.0 if side == "attack" else 0.0

    early_cutoff = player_events[0].timestamp_ms + duration_ms * 0.3
    early_kills = sum(
        1 for e in player_events
        if (e.type or "").upper() == "KILL" and e.timestamp_ms <= early_cutoff
    )
    early_kill_ratio = early_kills / max(kills, 1.0)

    rounds = {
        (e.metadata or {}).get("round")
        for e in player_events
        if e.metadata and (e.metadata.get("round") is not None)
    }
    round_participation = len(rounds) / max(len(rounds) + 1, 1)

    return {
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "objectives": objectives,
        "kill_death_ratio": kill_death_ratio,
        "actions_per_minute": actions_per_minute,
        "pattern_count": pattern_count,
        "attack_side": attack_side,
        "early_kill_ratio": early_kill_ratio,
        "round_participation": round_participation,
    }


def generate_synthetic_training_data(n_samples: int = 2000) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(42)
    x = np.zeros((n_samples, len(FEATURE_NAMES)), dtype=np.float32)

    x[:, 0] = rng.poisson(8, n_samples)
    x[:, 1] = rng.poisson(5, n_samples)
    x[:, 2] = rng.poisson(4, n_samples)
    x[:, 3] = rng.poisson(2, n_samples)
    x[:, 4] = np.clip(x[:, 0] / np.maximum(x[:, 1], 1), 0, 5)
    x[:, 5] = rng.uniform(2, 20, n_samples)
    x[:, 6] = rng.poisson(2, n_samples)
    x[:, 7] = rng.integers(0, 2, n_samples)
    x[:, 8] = rng.uniform(0, 1, n_samples)
    x[:, 9] = rng.uniform(0.3, 1.0, n_samples)

    weights = np.array([0.08, -0.12, 0.06, 0.10, 0.15, 0.04, 0.12, 0.03, 0.10, 0.08])
    noise = rng.normal(0, 0.05, n_samples)
    raw = 0.35 + x @ weights / 10.0 + noise
    y = np.clip(raw, 0.0, 1.0)
    return x, y


def _breakdown_component(features: np.ndarray, dimension: str) -> float:
    weights = _BREAKDOWN_WEIGHTS[dimension]
    raw = 0.45 + float(features @ weights) / 10.0
    return _clamp(raw)


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


_scorer: PlayerScorer | None = None


def get_scorer() -> PlayerScorer:
    global _scorer
    if _scorer is None:
        _scorer = PlayerScorer()
    return _scorer


def score_player(request: ScorePlayerRequest) -> ScorePlayerResponse:
    return get_scorer().score(request)
