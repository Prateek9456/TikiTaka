"""TikiTaka ML Service — Markov chain pattern detection + XGBoost player scoring."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from engines.markov import detect_patterns
from engines.scorer import get_scorer, score_player
from schemas import (
    DetectPatternsRequest,
    DetectPatternsResponse,
    ScorePlayerRequest,
    ScorePlayerResponse,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_scorer()
    logger.info("ML service ready")
    yield


app = FastAPI(title="TikiTaka ML Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/detect-patterns", response_model=DetectPatternsResponse)
def detect_patterns_endpoint(request: DetectPatternsRequest) -> DetectPatternsResponse:
    patterns = detect_patterns(request)
    logger.info(
        "Detected %d patterns for match %d (game %d)",
        len(patterns),
        request.match_id,
        request.game_id,
    )
    return DetectPatternsResponse(patterns=patterns)


@app.post("/score-player", response_model=ScorePlayerResponse)
def score_player_endpoint(request: ScorePlayerRequest) -> ScorePlayerResponse:
    response = score_player(request)
    logger.info(
        "Scored player %d in match %d: %.4f",
        request.player_id,
        request.match_id,
        response.tikitaka_score,
    )
    return response
