"""Demo match, pattern, and ladder data for urgent UI prototypes (no Riot API)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256

from django.conf import settings
from django.db import transaction

from apps.accounts.models import UserGameAccount
from apps.games.models import Game, GameSession, Player, TacticalPattern
from apps.ingestion.clients import normalize_riot_id_parts
from apps.ingestion.riot_api import build_riot_link_metadata
from apps.matches.models import (
    Match,
    MatchEvent,
    MatchPatternOccurrence,
    PlayerPerformanceScore,
    UserMatch,
)

PROTOTYPE_METADATA_FLAG = "prototypeDemo"

VALORANT_GAME_ID = 3
LOL_GAME_ID = 4

VALORANT_PATTERNS: list[tuple[str, str, str, list[str], str, int]] = [
    (
        "a-main-split",
        "A Main Split Execute",
        "Coordinated A Main smoke into dual-site pressure with late lurk.",
        ["smoke_a_main", "flash_entry", "split_a_heaven", "plant_default"],
        "0.6340",
        412,
    ),
    (
        "b-site-retake",
        "B Site Retake",
        "Post-plant retake through Market with utility trade sequencing.",
        ["molly_default", "flash_market", "defuse_contest"],
        "0.5875",
        289,
    ),
    (
        "mid-control-to-c",
        "Mid Control → C Hit",
        "Mid map control converted into a fast C Long execute.",
        ["smoke_mid", "flash_c_long", "swing_garage"],
        "0.5520",
        356,
    ),
    (
        "default-plant-anchor",
        "Default Plant Anchor",
        "Standard site take with anchor hold on common post-plant angles.",
        ["entry_duel", "smoke_site", "plant_default", "hold_anchor"],
        "0.6110",
        501,
    ),
    (
        "fast-execute-a",
        "Fast A Execute",
        "Five-man rush through A Lobby after early pick.",
        ["dash_entry", "smoke_a_tree", "plant_open"],
        "0.4980",
        198,
    ),
    (
        "lurk-timing-c",
        "C Lurk Timing",
        "Delayed C push punishing rotating defenders.",
        ["lurk_c_long", "info_gather", "swing_late"],
        "0.5710",
        244,
    ),
    (
        "eco-b-lurk",
        "Eco B Lurk",
        "Low-buy round with silent B Main flank into site contact.",
        ["silent_walk", "flank_b_main", "contact_plant"],
        "0.4460",
        127,
    ),
    (
        "post-plant-retake",
        "Post-Plant Retake Chain",
        "Coordinated retake utility chain after defender plant.",
        ["molly_plant", "flash_swing", "trade_defuse"],
        "0.6025",
        331,
    ),
]

LOL_PATTERNS: list[tuple[str, str, str, list[str], str, int]] = [
    (
        "dragon-soul-setup",
        "Dragon Soul Setup",
        "Vision layered into soul point contest with prio side waves.",
        ["ward_pit", "clear_side", "fight_dragon"],
        "0.6180",
        892,
    ),
    (
        "baron-vision-trap",
        "Baron Vision Trap",
        "Fake Baron into river pick before objective start.",
        ["sweeper_river", "bait_baron", "turn_fight"],
        "0.5640",
        445,
    ),
    (
        "bot-lane-dive",
        "Bot Lane Dive",
        "Tower dive after CC chain with jungle pathing sync.",
        ["cc_chain", "tower_dive", "plate_convert"],
        "0.5310",
        623,
    ),
    (
        "top-side-gank",
        "Top Side Gank",
        "Tri-brush gank into Herald setup and plate gold.",
        ["path_top", "gank_tri", "herald_take"],
        "0.5890",
        710,
    ),
    (
        "jungle-invade-counter",
        "Jungle Invade Counter",
        "Level-one invade punish into buff steal reversal.",
        ["invade_spot", "counter_gank", "buff_secure"],
        "0.5075",
        284,
    ),
    (
        "herald-to-tower",
        "Herald to Tower",
        "Herald charge into first turret plate conversion.",
        ["herald_charge", "plate_siege", "tower_dmg"],
        "0.5775",
        398,
    ),
    (
        "teamfight-flank",
        "Teamfight Flank",
        "Flank angle into backline during objective setup.",
        ["flank_angle", "engage_backline", "cleanup_fight"],
        "0.5430",
        556,
    ),
    (
        "split-push-pressure",
        "Split Push Pressure",
        "Side lane pressure forcing disengage from Baron dance.",
        ["push_side", "draw_rotations", "free_objective"],
        "0.5965",
        467,
    ),
]

VALORANT_LADDER = [
    ("NeonFade", 0.9312),
    ("cyphr.io", 0.9184),
    ("VCT_Aspirant", 0.9051),
    ("smokegod99", 0.8927),
    ("JettDiff_NA", 0.8810),
    ("yuri3256", 0.8743),  # placeholder; replaced with riot id
    ("clutchKING", 0.8615),
    ("OmenMainEU", 0.8492),
    ("reyna_one_tap", 0.8368),
    ("sage_res", 0.8241),
    ("viper_lineups", 0.8119),
]

LOL_LADDER = [
    ("FakerFan2024", 0.9288),
    ("jg_gap_real", 0.9156),
    ("top_diff_pls", 0.9024),
    ("support_roam", 0.8891),
    ("mid_prio_king", 0.8765),
    ("yuri3256", 0.8692),
    ("adc_farm_sim", 0.8560),
    ("baron_steal", 0.8437),
    ("herald_rider", 0.8314),
    ("vision_score", 0.8189),
    ("split_push_1v9", 0.8062),
]


def prototype_demo_enabled() -> bool:
    return bool(getattr(settings, "PROTOTYPE_DEMO", False))


def is_prototype_account(account: UserGameAccount | None) -> bool:
    if not account or not account.metadata:
        return False
    return bool(account.metadata.get(PROTOTYPE_METADATA_FLAG))


def _demo_puuid(game_name: str, tag_line: str) -> str:
    digest = sha256(f"{game_name}#{tag_line}".encode("utf-8")).hexdigest()
    return str(uuid.UUID(digest[:32]))


def _upsert_patterns(game_id: int, specs: list[tuple[str, str, str, list[str], str, int]]) -> list[TacticalPattern]:
    patterns: list[TacticalPattern] = []
    for slug, name, description, sequence, win_rate, sample_size in specs:
        pattern, _ = TacticalPattern.objects.update_or_create(
            game_id=game_id,
            pattern_slug=slug,
            defaults={
                "pattern_name": name,
                "description": description,
                "event_sequence": sequence,
                "win_rate": Decimal(win_rate),
                "sample_size": sample_size,
            },
        )
        patterns.append(pattern)
    return patterns


def _seed_match_for_user(
    user_id: int,
    game_id: int,
    puuid: str,
    riot_display: str,
    patterns: list[TacticalPattern],
    *,
    duration_seconds: int,
    event_count: int,
    hours_ago: float,
    ladder: list[tuple[str, float]],
    user_rank_index: int,
    external_suffix: str,
) -> Match:
    now = datetime.now(timezone.utc)
    played_at = now - timedelta(hours=hours_ago)
    external_match_id = f"proto-{external_suffix}-{user_id}-{puuid[:8]}"

    match, _ = Match.objects.update_or_create(
        game_id=game_id,
        external_match_id=external_match_id,
        defaults={
            "played_at": played_at,
            "duration_seconds": duration_seconds,
            "patch_version": "demo",
            "raw_data": {"prototype": True, "riotId": riot_display},
        },
    )

    MatchEvent.objects.filter(match=match).delete()
    for i in range(event_count):
        MatchEvent.objects.create(
            match=match,
            event_type="round_event" if game_id == VALORANT_GAME_ID else "game_event",
            timestamp_ms=i * 11_000,
            actor_id=puuid if i % 3 == 0 else f"ally-{i % 5}",
            metadata={"index": i},
        )

    MatchPatternOccurrence.objects.filter(match=match).delete()
    occurrence_specs = [
        (patterns[0], 145_000, "0.9100"),
        (patterns[1], 612_000, "0.8400"),
        (patterns[2], 1_045_000, "0.7900"),
        (patterns[3], 1_388_000, "0.8800"),
        (patterns[4], 1_720_000, "0.7600"),
        (patterns[5], 2_010_000, "0.8200"),
    ]
    for pattern, ts, confidence in occurrence_specs:
        MatchPatternOccurrence.objects.create(
            match=match,
            pattern=pattern,
            timestamp_ms=ts,
            confidence_score=Decimal(confidence),
        )

    user_player, _ = Player.objects.update_or_create(
        game_id=game_id,
        external_player_id=puuid,
        defaults={
            "username": riot_display.split("#")[0],
            "region": settings.RIOT_DEFAULT_REGION,
            "metadata": {"riot-id": riot_display, "prototype": True},
        },
    )

    PlayerPerformanceScore.objects.filter(match=match).delete()
    for idx, (name, score) in enumerate(ladder):
        display_name = riot_display.split("#")[0] if idx == user_rank_index else name
        external_id = puuid if idx == user_rank_index else f"proto-ladder-{game_id}-{idx}"
        player, _ = Player.objects.update_or_create(
            game_id=game_id,
            external_player_id=external_id,
            defaults={"username": display_name, "region": settings.RIOT_DEFAULT_REGION},
        )
        PlayerPerformanceScore.objects.create(
            player=player,
            match=match,
            pattern=patterns[idx % len(patterns)],
            score=Decimal(str(score)),
            computed_at=now,
        )

    UserMatch.objects.update_or_create(
        user_id=user_id,
        match=match,
        defaults={
            "game_id": game_id,
            "source": "PROTOTYPE_DEMO",
            "ingested_at": now,
        },
    )

    UserGameAccount.objects.filter(user_id=user_id, game_id=game_id).update(
        last_match_external_id=external_match_id,
        last_polled_at=now,
    )

    return match


def _seed_sessions(user_id: int, game_id: int) -> None:
    now = datetime.now(timezone.utc)
    GameSession.objects.filter(user_id=user_id, game_id=game_id, source="INFERRED").delete()
    offsets = [6, 30, 54, 120, 168]
    for hours_back, match_count in zip(offsets, [3, 2, 4, 1, 2], strict=True):
        start = now - timedelta(hours=hours_back)
        end = start + timedelta(hours=2, minutes=15)
        GameSession.objects.create(
            user_id=user_id,
            game_id=game_id,
            started_at=start,
            ended_at=end,
            match_count=match_count,
            source="INFERRED",
        )


@transaction.atomic
def seed_prototype_data_for_user(user_id: int, game_name: str, tag_line: str) -> dict:
    game_name, tag_line = normalize_riot_id_parts(game_name, tag_line)
    puuid = _demo_puuid(game_name, tag_line)
    routing_region = (settings.RIOT_DEFAULT_REGION or "americas").lower()
    metadata = {
        **build_riot_link_metadata(game_name, tag_line, routing_region),
        PROTOTYPE_METADATA_FLAG: True,
        "puuid": puuid,
    }
    riot_display = f"{game_name}#{tag_line}"

    val_patterns = _upsert_patterns(VALORANT_GAME_ID, VALORANT_PATTERNS)
    lol_patterns = _upsert_patterns(LOL_GAME_ID, LOL_PATTERNS)

    val_match = _seed_match_for_user(
        user_id,
        VALORANT_GAME_ID,
        puuid,
        riot_display,
        val_patterns,
        duration_seconds=42 * 60 + 15,
        event_count=168,
        hours_ago=2.4,
        ladder=VALORANT_LADDER,
        user_rank_index=5,
        external_suffix="val",
    )
    lol_match = _seed_match_for_user(
        user_id,
        LOL_GAME_ID,
        puuid,
        riot_display,
        lol_patterns,
        duration_seconds=30 * 60 + 47,
        event_count=214,
        hours_ago=5.1,
        ladder=LOL_LADDER,
        user_rank_index=5,
        external_suffix="lol",
    )

    _seed_sessions(user_id, VALORANT_GAME_ID)
    _seed_sessions(user_id, LOL_GAME_ID)

    synced_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "matchesIngested": 2,
        "accountsSynced": 2,
        "games": [
            {
                "gameId": VALORANT_GAME_ID,
                "matchesIngested": 1,
                "externalMatchIds": [val_match.external_match_id],
            },
            {
                "gameId": LOL_GAME_ID,
                "matchesIngested": 1,
                "externalMatchIds": [lol_match.external_match_id],
            },
        ],
        "errors": [],
        "syncedAt": synced_at,
        "message": f"Loaded demo analytics for {riot_display}",
    }


@transaction.atomic
def link_riot_prototype_demo(user_id: int, game_name: str, tag_line: str) -> tuple[dict, None]:
    game_name, tag_line = normalize_riot_id_parts(game_name, tag_line)
    if not game_name or not tag_line:
        from apps.core.exceptions import TikitakaException

        raise TikitakaException("Riot ID and tag are required", 400, "VALIDATION_ERROR")

    puuid = _demo_puuid(game_name, tag_line)
    routing_region = (settings.RIOT_DEFAULT_REGION or "americas").lower()
    metadata = {
        **build_riot_link_metadata(game_name, tag_line, routing_region),
        PROTOTYPE_METADATA_FLAG: True,
        "puuid": puuid,
    }

    for game_id in (VALORANT_GAME_ID, LOL_GAME_ID):
        game = Game.objects.filter(id=game_id).first()
        if game:
            UserGameAccount.objects.update_or_create(
                user_id=user_id,
                game=game,
                defaults={
                    "external_player_id": puuid,
                    "metadata": metadata,
                },
            )

    sync_result = seed_prototype_data_for_user(user_id, game_name, tag_line)
    return sync_result, None


def ensure_prototype_dashboard_data(user_id: int, game_id: int) -> None:
    """Fill demo analytics when a game is linked but has no ingested matches yet."""
    if not prototype_demo_enabled() or game_id not in (VALORANT_GAME_ID, LOL_GAME_ID):
        return
    latest_um = (
        UserMatch.objects.filter(user_id=user_id, game_id=game_id)
        .select_related("match")
        .order_by("-match__played_at")
        .first()
    )
    if latest_um and MatchPatternOccurrence.objects.filter(match=latest_um.match).exists():
        return
    account = UserGameAccount.objects.filter(user_id=user_id, game_id=game_id).first()
    if not account:
        return

    meta = account.metadata if isinstance(account.metadata, dict) else {}
    riot_id = meta.get("riot-id")
    if riot_id and "#" in riot_id:
        game_name, tag_line = riot_id.split("#", 1)
    else:
        from apps.accounts.models import User

        user = User.objects.filter(id=user_id).first()
        game_name = (user.username or user.display_name or "DemoPlayer") if user else "DemoPlayer"
        tag_line = "NA1"

    seed_prototype_data_for_user(user_id, game_name, tag_line)


def prototype_sync_result(user_id: int, game_id: int | None = None) -> dict:
    accounts = UserGameAccount.objects.filter(
        user_id=user_id,
        metadata__contains={PROTOTYPE_METADATA_FLAG: True},
    )
    if game_id:
        accounts = accounts.filter(game_id=game_id)
    account_list = list(accounts.select_related("game"))
    if not account_list:
        return {
            "matchesIngested": 0,
            "accountsSynced": 0,
            "games": [],
            "errors": [],
            "syncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "message": "No prototype accounts to sync",
        }

    meta = account_list[0].metadata or {}
    riot_id = meta.get("riot-id", "")
    if riot_id and "#" in riot_id:
        name, tag = riot_id.split("#", 1)
        sync_result = seed_prototype_data_for_user(user_id, name, tag)
        if game_id is not None:
            sync_result["games"] = [g for g in sync_result["games"] if g["gameId"] == game_id]
            sync_result["matchesIngested"] = sum(g["matchesIngested"] for g in sync_result["games"])
            sync_result["accountsSynced"] = len(sync_result["games"])
        sync_result["message"] = f"Refreshed demo data for {len(account_list)} account(s)"
        return sync_result

    return {
        "matchesIngested": 0,
        "accountsSynced": len(account_list),
        "games": [],
        "errors": [],
        "syncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "message": "Prototype accounts linked but missing Riot ID metadata",
    }
