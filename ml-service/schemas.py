"""Request/response models aligned with Java analytics DTOs (camelCase JSON)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class EventPayload(CamelModel):
    type: str
    timestamp_ms: int = Field(alias="timestampMs")
    actor: str | None = None
    metadata: dict[str, Any] | None = None


class DetectPatternsRequest(CamelModel):
    game_id: int = Field(alias="gameId")
    match_id: int = Field(alias="matchId")
    events: list[EventPayload]


class DetectedPattern(CamelModel):
    pattern_slug: str = Field(alias="patternSlug")
    confidence: float
    start_ts: int = Field(alias="startTs")
    end_ts: int = Field(alias="endTs")


class DetectPatternsResponse(CamelModel):
    patterns: list[DetectedPattern]


class ScorePlayerRequest(CamelModel):
    game_id: int = Field(alias="gameId")
    player_id: int = Field(alias="playerId")
    match_id: int = Field(alias="matchId")
    events: list[EventPayload]
    pattern_context: dict[str, Any] | None = Field(default=None, alias="patternContext")


class ScoreBreakdown(CamelModel):
    aggression: float
    positioning: float
    timing: float


class ScorePlayerResponse(CamelModel):
    tikitaka_score: float = Field(alias="tikitakaScore")
    breakdown: ScoreBreakdown
