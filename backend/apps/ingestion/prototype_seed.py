"""Demo match, pattern, and ladder data for urgent UI prototypes (no Riot API)."""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from hashlib import sha256

from django.conf import settings
from django.db import transaction

from apps.accounts.models import LinkedAccount, UserGameAccount
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

VALORANT_PATTERNS = [
    (
        "a-main-split",
        "A Main Split Execute",
        "Coordinated A Main smoke into dual-site pressure with late lurk.",
        ["smoke_a_main", "flash_entry", "split_a_heaven", "plant_default"],
    ),
    (
        "b-site-retake",
        "B Site Retake",
        "Post-plant retake through Market with utility trade sequencing.",
        ["molly_default", "flash_market", "defuse_contest"],
    ),
    (
        "mid-control-to-c",
        "Mid Control → C Hit",
        "Mid map control converted into a fast C Long execute.",
        ["smoke_mid", "flash_c_long", "swing_garage"],
    ),
    (
        "default-plant-anchor",
        "Default Plant Anchor",
        "Standard site take with anchor hold on common post-plant angles.",
        ["entry_duel", "smoke_site", "plant_default", "hold_anchor"],
    ),
    (
        "fast-execute-a",
        "Fast A Execute",
        "Five-man rush through A Lobby after early pick.",
        ["dash_entry", "smoke_a_tree", "plant_open"],
    ),
    (
        "lurk-timing-c",
        "C Lurk Timing",
        "Delayed C push punishing rotating defenders.",
        ["lurk_c_long", "info_gather", "swing_late"],
    ),
    (
        "eco-b-lurk",
        "Eco B Lurk",
        "Low-buy round with silent B Main flank into site contact.",
        ["silent_walk", "flank_b_main", "contact_plant"],
    ),
    (
        "post-plant-retake",
        "Post-Plant Retake Chain",
        "Coordinated retake utility chain after defender plant.",
        ["molly_plant", "flash_swing", "trade_defuse"],
    ),
]

LOL_PATTERNS = [
    (
        "dragon-soul-setup",
        "Dragon Soul Setup",
        "Vision layered into soul point contest with prio side waves.",
        ["ward_pit", "clear_side", "fight_dragon"],
    ),
    (
        "baron-vision-trap",
        "Baron Vision Trap",
        "Fake Baron into river pick before objective start.",
        ["sweeper_river", "bait_baron", "turn_fight"],
    ),
    (
        "bot-lane-dive",
        "Bot Lane Dive",
        "Tower dive after CC chain with jungle pathing sync.",
        ["cc_chain", "tower_dive", "plate_convert"],
    ),
    (
        "top-side-gank",
        "Top Side Gank",
        "Tri-brush gank into Herald setup and plate gold.",
        ["path_top", "gank_tri", "herald_take"],
    ),
    (
        "jungle-invade-counter",
        "Jungle Invade Counter",
        "Level-one invade punish into buff steal reversal.",
        ["invade_spot", "counter_gank", "buff_secure"],
    ),
    (
        "herald-to-tower",
        "Herald to Tower",
        "Herald charge into first turret plate conversion.",
        ["herald_charge", "plate_siege", "tower_dmg"],
    ),
    (
        "teamfight-flank",
        "Teamfight Flank",
        "Flank angle into backline during objective setup.",
        ["flank_angle", "engage_backline", "cleanup_fight"],
    ),
    (
        "split-push-pressure",
        "Split Push Pressure",
        "Side lane pressure forcing disengage from Baron dance.",
        ["push_side", "draw_rotations", "free_objective"],
    ),
]

VALORANT_OPPONENTS_POOL = [
    "NeonFade",
    "cyphr.io",
    "VCT_Aspirant",
    "smokegod99",
    "JettDiff_NA",
    "clutchKING",
    "OmenMainEU",
    "reyna_one_tap",
    "sage_res",
    "viper_lineups",
    "TenZ_Fan",
    "DerkeSmurf",
    "ChronicleEU",
    "BoasterDance",
    "ScreaM_Edshot",
    "AspasCarry",
    "YayElDiablo",
    "cNedGod",
    "AlfajerAnchor",
    "Demon1Clutch",
    "ZellsisVibes",
]

LOL_OPPONENTS_POOL = [
    "FakerFan2024",
    "jg_gap_real",
    "top_diff_pls",
    "support_roam",
    "mid_prio_king",
    "adc_farm_sim",
    "baron_steal",
    "herald_rider",
    "vision_score",
    "split_push_1v9",
    "ChovyCSGod",
    "ShowMakerPlay",
    "CapsCraps",
    "DeftDance",
    "KeriaGenius",
    "BinSoloKill",
    "RulerPenta",
    "CanyonJungle",
    "ZeusSoloQ",
    "OnerSmite",
    "GumayusiSteal",
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


def cleanup_prototype_data_for_user(user_id: int, game_id: int | None = None) -> None:
    """Safely wipe previous prototype demo records for a user so fresh random stats populate cleanly."""
    games = [game_id] if game_id else [VALORANT_GAME_ID, LOL_GAME_ID]
    user_matches = UserMatch.objects.filter(user_id=user_id, game_id__in=games)
    match_ids = list(user_matches.values_list("match_id", flat=True))

    if match_ids:
        MatchPatternOccurrence.objects.filter(match_id__in=match_ids).delete()
        MatchEvent.objects.filter(match_id__in=match_ids).delete()
        PlayerPerformanceScore.objects.filter(match_id__in=match_ids).delete()
        user_matches.delete()
        Match.objects.filter(id__in=match_ids, external_match_id__startswith="proto-").delete()

    GameSession.objects.filter(
        user_id=user_id,
        game_id__in=games,
        source="INFERRED",
    ).delete()


def _upsert_patterns(game_id: int, specs: list[tuple[str, str, str, list[str]]]) -> list[TacticalPattern]:
    patterns: list[TacticalPattern] = []
    # Dynamic realistic ranges based on game
    is_val = game_id == VALORANT_GAME_ID
    min_wr, max_wr = (0.4700, 0.6800) if is_val else (0.4800, 0.6600)
    min_samples, max_samples = (180, 680) if is_val else (380, 1280)

    for slug, name, description, sequence in specs:
        rand_wr = round(random.uniform(min_wr, max_wr), 4)
        rand_samples = random.randint(min_samples, max_samples)
        pattern, _ = TacticalPattern.objects.update_or_create(
            game_id=game_id,
            pattern_slug=slug,
            defaults={
                "pattern_name": name,
                "description": description,
                "event_sequence": sequence,
                "win_rate": Decimal(f"{rand_wr:.4f}"),
                "sample_size": rand_samples,
            },
        )
        patterns.append(pattern)
    return patterns


def _build_random_ladder(game_id: int, riot_display: str) -> tuple[list[tuple[str, float]], int]:
    pool = VALORANT_OPPONENTS_POOL if game_id == VALORANT_GAME_ID else LOL_OPPONENTS_POOL
    opponents = random.sample(pool, 10)

    # Place the user at a realistic competitive rank (e.g. #2 to #6)
    user_rank_index = random.randint(1, 5)
    user_name = riot_display.split("#")[0]

    # Monotonically descending scores
    curr_score = round(random.uniform(0.9250, 0.9550), 4)
    ladder: list[tuple[str, float]] = []
    for idx in range(11):
        if idx == user_rank_index:
            ladder.append((user_name, curr_score))
        else:
            ladder.append((opponents.pop(0), curr_score))
        curr_score = round(curr_score - random.uniform(0.0080, 0.0160), 4)

    return ladder, user_rank_index


def _seed_match_for_user(
    user_id: int,
    game_id: int,
    puuid: str,
    riot_display: str,
    patterns: list[TacticalPattern],
    *,
    external_suffix: str,
) -> Match:
    now = datetime.now(timezone.utc)
    is_val = game_id == VALORANT_GAME_ID

    # Realistic randomized match parameters
    duration_seconds = (
        random.randint(31 * 60, 45 * 60) if is_val else random.randint(23 * 60, 37 * 60)
    )
    event_count = random.randint(145, 235) if is_val else random.randint(185, 310)
    hours_ago = round(random.uniform(0.4, 2.8), 2) if is_val else round(random.uniform(0.8, 4.5), 2)
    played_at = now - timedelta(hours=hours_ago)
    nonce = random.randint(1000, 9999)
    external_match_id = f"proto-{external_suffix}-{user_id}-{puuid[:8]}-{nonce}"

    match, _ = Match.objects.update_or_create(
        game_id=game_id,
        external_match_id=external_match_id,
        defaults={
            "played_at": played_at,
            "duration_seconds": duration_seconds,
            "patch_version": "10.04" if is_val else "14.20",
            "raw_data": {"riotId": riot_display, "queue": "competitive"},
        },
    )

    MatchEvent.objects.filter(match=match).delete()
    step_ms = max(5_000, int((duration_seconds * 1000) / max(event_count, 1)))
    events_to_create = []
    for i in range(event_count):
        events_to_create.append(
            MatchEvent(
                match=match,
                event_type="round_event" if is_val else "game_event",
                timestamp_ms=min(i * step_ms + random.randint(100, 1500), duration_seconds * 1000),
                actor_id=puuid if i % 3 == 0 else f"ally-{i % 5}",
                metadata={"index": i},
            )
        )
    MatchEvent.objects.bulk_create(events_to_create)

    MatchPatternOccurrence.objects.filter(match=match).delete()
    # Pick 5 to 7 random patterns with distributed timestamps across the match
    occurrence_count = random.randint(5, min(7, len(patterns)))
    chosen_patterns = random.sample(patterns, occurrence_count)
    pattern_timestamps = sorted(
        random.sample(
            range(int(duration_seconds * 100), int(duration_seconds * 950)),
            k=occurrence_count,
        )
    )

    occurrences_to_create = []
    for pat, ts in zip(chosen_patterns, pattern_timestamps, strict=True):
        rand_conf = round(random.uniform(0.7400, 0.9450), 4)
        occurrences_to_create.append(
            MatchPatternOccurrence(
                match=match,
                pattern=pat,
                timestamp_ms=ts,
                confidence_score=Decimal(f"{rand_conf:.4f}"),
            )
        )
    MatchPatternOccurrence.objects.bulk_create(occurrences_to_create)

    user_player, _ = Player.objects.update_or_create(
        game_id=game_id,
        external_player_id=puuid,
        defaults={
            "username": riot_display.split("#")[0],
            "region": settings.RIOT_DEFAULT_REGION,
            "metadata": {"riot-id": riot_display},
        },
    )

    # Ladder & Leaderboard
    ladder, user_rank_index = _build_random_ladder(game_id, riot_display)
    PlayerPerformanceScore.objects.filter(match=match).delete()

    ladder_scores_to_create = []
    for idx, (name, score) in enumerate(ladder):
        is_user = idx == user_rank_index
        display_name = riot_display.split("#")[0] if is_user else name
        external_id = puuid if is_user else f"proto-ladder-{game_id}-{idx}"
        player, _ = Player.objects.update_or_create(
            game_id=game_id,
            external_player_id=external_id,
            defaults={"username": display_name, "region": settings.RIOT_DEFAULT_REGION},
        )
        ladder_scores_to_create.append(
            PlayerPerformanceScore(
                player=player,
                match=match,
                pattern=patterns[idx % len(patterns)],
                score=Decimal(f"{score:.4f}"),
                computed_at=now,
            )
        )
    PlayerPerformanceScore.objects.bulk_create(ladder_scores_to_create)

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

    # 5 sessions across past 7 days with realistic durations and match counts
    offsets = [
        random.randint(4, 9),
        random.randint(22, 34),
        random.randint(48, 62),
        random.randint(92, 114),
        random.randint(142, 168),
    ]
    sessions_to_create = []
    for hours_back in offsets:
        start = now - timedelta(hours=hours_back, minutes=random.randint(5, 45))
        duration_minutes = random.randint(75, 195)
        end = start + timedelta(minutes=duration_minutes)
        match_count = random.randint(1, 4)
        sessions_to_create.append(
            GameSession(
                user_id=user_id,
                game_id=game_id,
                started_at=start,
                ended_at=end,
                match_count=match_count,
                source="INFERRED",
            )
        )
    GameSession.objects.bulk_create(sessions_to_create)


@transaction.atomic
def seed_prototype_data_for_user(user_id: int, game_name: str, tag_line: str) -> dict:
    """Generate realistic randomized prototype statistics and matches for Valorant and LoL."""
    game_name, tag_line = normalize_riot_id_parts(game_name, tag_line)
    puuid = _demo_puuid(game_name, tag_line)
    riot_display = f"{game_name}#{tag_line}"

    # Clean up any stale prototype records for this user first
    cleanup_prototype_data_for_user(user_id)

    val_patterns = _upsert_patterns(VALORANT_GAME_ID, VALORANT_PATTERNS)
    lol_patterns = _upsert_patterns(LOL_GAME_ID, LOL_PATTERNS)

    val_match = _seed_match_for_user(
        user_id,
        VALORANT_GAME_ID,
        puuid,
        riot_display,
        val_patterns,
        external_suffix="val",
    )
    lol_match = _seed_match_for_user(
        user_id,
        LOL_GAME_ID,
        puuid,
        riot_display,
        lol_patterns,
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
        "message": f"Loaded match analytics for {riot_display}",
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

    # Upsert UserGameAccount for Valorant and LoL
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

    # Also upsert LinkedAccount for RIOT so that settings / account profile displays it properly
    LinkedAccount.objects.update_or_create(
        user_id=user_id,
        provider="RIOT",
        defaults={
            "provider_user_id": puuid,
            "display_name": f"{game_name}#{tag_line}",
            "access_token": "",
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
        sync_result["message"] = f"Synced match data for {len(account_list)} account(s)"
        return sync_result

    return {
        "matchesIngested": 0,
        "accountsSynced": len(account_list),
        "games": [],
        "errors": [],
        "syncedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "message": "Prototype accounts linked but missing Riot ID metadata",
    }
