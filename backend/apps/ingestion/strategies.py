import logging
from datetime import datetime, timezone

from django.conf import settings

from apps.ingestion.clients import FaceitClient, OpenDotaClient, RiotApiClient

logger = logging.getLogger(__name__)

STEAM_OFFSET = 76561197960265728


class BaseStrategy:
    game_id = None
    game_slug = None

    def fetch_recent_matches(self, player_context=None, limit=5):
        raise NotImplementedError

    def fetch_match_by_id(self, external_match_id):
        raise NotImplementedError


class Dota2Strategy(BaseStrategy):
    game_id = 1
    game_slug = "dota2"

    def __init__(self):
        self.client = OpenDotaClient()

    def _resolve_account_id(self, ctx):
        if ctx and ctx.get("external_player_id"):
            return ctx["external_player_id"]
        if settings.DOTA2_ACCOUNT_ID:
            return settings.DOTA2_ACCOUNT_ID
        if settings.DOTA2_STEAM_ID:
            return str(int(settings.DOTA2_STEAM_ID) - STEAM_OFFSET)
        return None

    def fetch_recent_matches(self, player_context=None, limit=5):
        account_id = self._resolve_account_id(player_context)
        if account_id:
            match_list = self.client.get_player_matches(account_id, limit)
            match_ids = [m["match_id"] for m in match_list]
        elif settings.DOTA2_USE_PUBLIC_FALLBACK:
            public = self.client.get_public_matches(limit)
            match_ids = [m["match_id"] for m in public]
        else:
            return []

        matches = []
        for mid in match_ids:
            try:
                matches.append(self._map_match(self.client.get_match(mid)))
            except Exception as exc:
                logger.warning("Failed to fetch Dota2 match %s: %s", mid, exc)
        return matches

    def fetch_match_by_id(self, external_match_id):
        return self._map_match(self.client.get_match(external_match_id))

    def _map_match(self, data):
        events = []
        for p in data.get("players", []):
            kills = p.get("kills", 0)
            deaths = p.get("deaths", 0)
            assists = p.get("assists", 0)
            pid = str(p.get("account_id", p.get("hero_id", "")))
            if kills:
                events.append({"eventType": "KILL", "timestampMs": 0, "actorId": pid, "targetId": None, "metadata": {"count": kills}})
            if deaths:
                events.append({"eventType": "DEATH", "timestampMs": 0, "actorId": pid, "targetId": None, "metadata": {"count": deaths}})
            if assists:
                events.append({"eventType": "ASSIST", "timestampMs": 0, "actorId": pid, "targetId": None, "metadata": {"count": assists}})

        for obj in data.get("objectives", []):
            events.append({
                "eventType": "OBJECTIVE",
                "timestampMs": obj.get("time", 0) * 1000,
                "actorId": str(obj.get("player_slot", "")),
                "targetId": obj.get("type"),
                "metadata": obj,
            })

        start = data.get("start_time", 0)
        return {
            "externalMatchId": str(data["match_id"]),
            "payload": {"match_id": data["match_id"], "radiant_win": data.get("radiant_win"), "game_mode": data.get("game_mode")},
            "events": events,
            "playedAt": datetime.fromtimestamp(start, tz=timezone.utc).isoformat() if start else datetime.now(timezone.utc).isoformat(),
            "durationSeconds": data.get("duration", 0),
            "patchVersion": str(data.get("patch", "")),
        }


class Cs2Strategy(BaseStrategy):
    game_id = 2
    game_slug = "cs2"

    def __init__(self):
        self.client = FaceitClient()

    def _resolve_player_id(self, ctx):
        if ctx:
            meta = ctx.get("metadata") or {}
            if meta.get("faceit-id"):
                return meta["faceit-id"]
            steam = ctx.get("external_player_id") or meta.get("steam-id")
            if steam and str(steam).startswith("7656119"):
                return self.client.get_player_by_steam_id(steam)["player_id"]
        if settings.CS2_FACEIT_PLAYER_ID:
            return settings.CS2_FACEIT_PLAYER_ID
        if settings.CS2_STEAM_ID:
            return self.client.get_player_by_steam_id(settings.CS2_STEAM_ID)["player_id"]
        return None

    def fetch_recent_matches(self, player_context=None, limit=5):
        player_id = self._resolve_player_id(player_context)
        if not player_id:
            return []
        history = self.client.get_match_history(player_id, limit)
        matches = []
        for item in history.get("items", []):
            try:
                matches.append(self._map_match(item["match_id"]))
            except Exception as exc:
                logger.warning("Failed to fetch CS2 match %s: %s", item["match_id"], exc)
        return matches

    def fetch_match_by_id(self, external_match_id):
        return self._map_match(external_match_id)

    def _map_match(self, match_id):
        meta = self.client.get_match(match_id)
        stats = self.client.get_match_stats(match_id)
        events = []
        round_num = 0
        for rnd in stats.get("rounds", []):
            round_num += 1
            ts = round_num * 115000
            winner = rnd.get("round_stats", {}).get("Winner")
            if winner:
                events.append({"eventType": "ROUND_WIN", "timestampMs": ts, "actorId": winner, "targetId": None, "metadata": {"round": round_num}})

        started = meta.get("started_at", 0)
        if isinstance(started, int):
            played_at = datetime.fromtimestamp(started, tz=timezone.utc).isoformat()
        else:
            played_at = datetime.now(timezone.utc).isoformat()

        return {
            "externalMatchId": match_id,
            "payload": {"matchId": match_id, "game": "cs2", "status": meta.get("status")},
            "events": events,
            "playedAt": played_at,
            "durationSeconds": meta.get("finished_at", 0) - meta.get("started_at", 0) if isinstance(started, int) else 0,
            "patchVersion": "",
        }


class ValorantStrategy(BaseStrategy):
    game_id = 3
    game_slug = "valorant"

    def __init__(self, region=None):
        self.client = RiotApiClient(region)

    def _resolve_puuid(self, ctx):
        if ctx and ctx.get("external_player_id"):
            return ctx["external_player_id"]
        return settings.VALORANT_SEED_PUUID or None

    def fetch_recent_matches(self, player_context=None, limit=5):
        puuid = self._resolve_puuid(player_context)
        if not puuid:
            return []
        matchlist = self.client.get_valorant_matchlist(puuid, limit)
        matches = []
        for entry in matchlist.get("history", []):
            try:
                matches.append(self._map_match(entry["matchId"]))
            except Exception as exc:
                logger.warning("Failed to fetch Valorant match %s: %s", entry["matchId"], exc)
        return matches

    def fetch_match_by_id(self, external_match_id):
        return self._map_match(external_match_id)

    def _map_match(self, match_id):
        data = self.client.get_valorant_match(match_id)
        events = []
        for rnd in data.get("roundResults", []):
            ts = rnd.get("roundNum", 0) * 60000
            events.append({"eventType": "ROUND_END", "timestampMs": ts, "actorId": rnd.get("winningTeam"), "targetId": None, "metadata": rnd})
            for ps in rnd.get("playerStats", []):
                for kill in ps.get("kills", []):
                    events.append({
                        "eventType": "KILL",
                        "timestampMs": kill.get("timeSinceGameStartMillis", ts),
                        "actorId": ps.get("puuid"),
                        "targetId": kill.get("victim"),
                        "metadata": kill,
                    })

        return {
            "externalMatchId": match_id,
            "payload": {"matchId": match_id, "mapId": data.get("matchInfo", {}).get("mapId")},
            "events": events,
            "playedAt": datetime.fromtimestamp(
                data.get("matchInfo", {}).get("gameStartMillis", 0) / 1000, tz=timezone.utc
            ).isoformat(),
            "durationSeconds": data.get("matchInfo", {}).get("gameLengthMillis", 0) // 1000,
            "patchVersion": data.get("matchInfo", {}).get("gameVersion", ""),
        }


class LolStrategy(BaseStrategy):
    game_id = 4
    game_slug = "lol"

    def __init__(self, region=None):
        self.client = RiotApiClient(region)

    def _resolve_puuid(self, ctx):
        if ctx and ctx.get("external_player_id"):
            return ctx["external_player_id"]
        if settings.LOL_SEED_PUUID:
            return settings.LOL_SEED_PUUID
        if settings.LOL_RIOT_ID and settings.LOL_RIOT_TAG:
            return self.client.get_lol_account_by_riot_id(settings.LOL_RIOT_ID, settings.LOL_RIOT_TAG)["puuid"]
        return None

    def fetch_recent_matches(self, player_context=None, limit=5):
        puuid = self._resolve_puuid(player_context)
        if not puuid:
            return []
        match_ids = self.client.get_lol_match_ids(puuid, limit)
        matches = []
        for mid in match_ids:
            try:
                matches.append(self._map_match(mid))
            except Exception as exc:
                logger.warning("Failed to fetch LoL match %s: %s", mid, exc)
        return matches

    def fetch_match_by_id(self, external_match_id):
        return self._map_match(external_match_id)

    def _map_match(self, match_id):
        data = self.client.get_lol_match(match_id)
        timeline = self.client.get_lol_timeline(match_id)
        events = []
        for frame in timeline.get("info", {}).get("frames", []):
            for ev in frame.get("events", []):
                etype = ev.get("type", "")
                ts = ev.get("timestamp", 0)
                if etype == "CHAMPION_KILL":
                    events.append({"eventType": "KILL", "timestampMs": ts, "actorId": str(ev.get("killerId")), "targetId": str(ev.get("victimId")), "metadata": ev})
                elif etype == "BUILDING_KILL":
                    events.append({"eventType": "OBJECTIVE", "timestampMs": ts, "actorId": str(ev.get("killerId")), "targetId": ev.get("buildingType"), "metadata": ev})

        info = data.get("info", {})
        return {
            "externalMatchId": match_id,
            "payload": {"matchId": match_id, "mapId": info.get("mapId"), "gameMode": info.get("gameMode")},
            "events": events,
            "playedAt": datetime.fromtimestamp(info.get("gameStartTimestamp", 0) / 1000, tz=timezone.utc).isoformat(),
            "durationSeconds": info.get("gameDuration", 0),
            "patchVersion": info.get("gameVersion", ""),
        }


STRATEGIES = {
    1: Dota2Strategy,
    2: Cs2Strategy,
    3: ValorantStrategy,
    4: LolStrategy,
}

SLUG_TO_ID = {"dota2": 1, "cs2": 2, "valorant": 3, "lol": 4}


def get_strategy(game_id):
    cls = STRATEGIES.get(game_id)
    if not cls:
        raise ValueError(f"No strategy for game {game_id}")
    return cls()
