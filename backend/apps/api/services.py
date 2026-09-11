from datetime import datetime, timezone
from decimal import Decimal

from django.core.paginator import Paginator
from django.db.models import Avg, Count

from apps.accounts.models import AuthSession, UserGameAccount
from apps.core.exceptions import TikitakaException
from apps.games.models import Game, GameSession, Player, TacticalPattern
from apps.matches.models import Match, MatchEvent, MatchPatternOccurrence, PlayerPerformanceScore, UserMatch


def list_games():
    return [
        {
            "id": g.id,
            "name": g.name,
            "slug": g.slug,
            "apiSource": g.api_source,
            "isActive": g.is_active,
        }
        for g in Game.objects.filter(is_active=True).order_by("id")
    ]


def list_patterns(game_id, sort_by="winRate", page=0, size=20):
    qs = TacticalPattern.objects.filter(game_id=game_id)
    if sort_by == "winRate":
        qs = qs.order_by("-win_rate")
    elif sort_by == "sampleSize":
        qs = qs.order_by("-sample_size")
    else:
        qs = qs.order_by("pattern_name")

    paginator = Paginator(qs, size)
    page_obj = paginator.get_page(page + 1)

    content = [
        {
            "id": p.id,
            "gameId": p.game_id,
            "patternName": p.pattern_name,
            "patternSlug": p.pattern_slug,
            "description": p.description,
            "eventSequence": p.event_sequence or [],
            "winRate": float(p.win_rate) if p.win_rate else 0.0,
            "sampleSize": p.sample_size or 0,
        }
        for p in page_obj.object_list
    ]

    return {
        "content": content,
        "page": page,
        "size": size,
        "totalElements": paginator.count,
        "totalPages": paginator.num_pages,
        "first": page == 0,
        "last": page >= paginator.num_pages - 1,
    }


def get_leaderboard(user_id, game_id, metric="tikitaka_score"):
    current_player_id = None
    account = UserGameAccount.objects.filter(user_id=user_id, game_id=game_id).first()
    if account:
        player = Player.objects.filter(game_id=game_id, external_player_id=account.external_player_id).first()
        if player:
            current_player_id = player.id

    rows = (
        PlayerPerformanceScore.objects.filter(player__game_id=game_id)
        .values("player_id", "player__username")
        .annotate(avg_score=Avg("score"))
        .order_by("-avg_score")
    )

    entries = []
    rank = 1
    for row in rows:
        entries.append({
            "playerId": row["player_id"],
            "username": row["player__username"],
            "gameId": game_id,
            "metric": metric,
            "score": round(float(row["avg_score"]), 4),
            "rank": rank,
            "currentUser": row["player_id"] == current_player_id,
        })
        rank += 1

    top = [e for e in entries if e["rank"] <= 10]
    if current_player_id:
        user_entry = next((e for e in entries if e["playerId"] == current_player_id), None)
        if user_entry and user_entry["rank"] > 10 and user_entry not in top:
            top.append(user_entry)
    return top


def _build_match_analysis(match):
    occurrences = MatchPatternOccurrence.objects.filter(match=match).select_related("pattern")
    event_count = MatchEvent.objects.filter(match=match).count()
    return {
        "matchId": match.id,
        "externalMatchId": match.external_match_id,
        "gameId": match.game_id,
        "playedAt": match.played_at.isoformat().replace("+00:00", "Z"),
        "durationSeconds": match.duration_seconds,
        "eventCount": event_count,
        "patternOccurrenceCount": occurrences.count(),
        "patterns": [
            {
                "patternSlug": o.pattern.pattern_slug,
                "confidence": float(o.confidence_score),
                "timestampMs": o.timestamp_ms,
            }
            for o in occurrences
        ],
    }


def get_latest_match(user_id, game_id):
    account = UserGameAccount.objects.filter(user_id=user_id, game_id=game_id).first()
    if not account:
        raise TikitakaException(
            f"Game account not found for user {user_id} game {game_id}",
            404,
            "NOT_FOUND",
        )

    um = (
        UserMatch.objects.filter(user_id=user_id, game_id=game_id)
        .select_related("match")
        .order_by("-match__played_at")
        .first()
    )
    if um:
        return _build_match_analysis(um.match)

    if account.last_match_external_id:
        match = Match.objects.filter(game_id=game_id, external_match_id=account.last_match_external_id).first()
        if match:
            return _build_match_analysis(match)

    raise TikitakaException(
        f"Match not found: latest for user {user_id} game {game_id}",
        404,
        "NOT_FOUND",
    )


def get_match_analysis(user_id, match_id):
    if not UserMatch.objects.filter(user_id=user_id, match_id=match_id).exists():
        raise TikitakaException("Match not accessible for current user", 403, "MATCH_ACCESS_DENIED")
    match = Match.objects.filter(id=match_id).first()
    if not match:
        raise TikitakaException(f"Match not found: {match_id}", 404, "NOT_FOUND")
    return _build_match_analysis(match)


def get_auth_sessions(user_id):
    return [
        {
            "id": s.id,
            "provider": s.provider,
            "loginAt": s.login_at.isoformat().replace("+00:00", "Z"),
            "logoutAt": s.logout_at.isoformat().replace("+00:00", "Z") if s.logout_at else None,
            "ipAddress": s.ip_address,
            "userAgent": s.user_agent,
            "location": s.location,
        }
        for s in AuthSession.objects.filter(user_id=user_id).order_by("-login_at")
    ]


def get_game_sessions(user_id, game_id=None, from_dt=None, to_dt=None):
    from_dt = from_dt or datetime(1970, 1, 1, tzinfo=timezone.utc)
    to_dt = to_dt or datetime.now(timezone.utc)

    if from_dt > to_dt:
        raise TikitakaException("'from' must be before or equal to 'to'", 400, "INVALID_DATE_RANGE")

    qs = GameSession.objects.filter(user_id=user_id, started_at__gte=from_dt, started_at__lte=to_dt)
    if game_id:
        qs = qs.filter(game_id=game_id)

    return [
        {
            "id": s.id,
            "gameId": s.game_id,
            "gameName": s.game.name,
            "startedAt": s.started_at.isoformat().replace("+00:00", "Z"),
            "endedAt": s.ended_at.isoformat().replace("+00:00", "Z"),
            "matchCount": s.match_count,
            "source": s.source,
        }
        for s in qs.select_related("game").order_by("-started_at")
    ]
