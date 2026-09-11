import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

OPENDOTA_BASE = "https://api.opendota.com/api"
FACEIT_BASE = "https://open.faceit.com/data/v4"


def _riot_base(region=None):
    return f"https://{region or settings.RIOT_DEFAULT_REGION}.api.riotgames.com"


class OpenDotaClient:
    def get_public_matches(self, limit=5):
        resp = httpx.get(f"{OPENDOTA_BASE}/publicMatches", params={"limit": limit}, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_player_matches(self, account_id, limit=5):
        resp = httpx.get(f"{OPENDOTA_BASE}/players/{account_id}/matches", params={"limit": limit}, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_match(self, match_id):
        resp = httpx.get(f"{OPENDOTA_BASE}/matches/{match_id}", timeout=30.0)
        resp.raise_for_status()
        return resp.json()


class RiotApiClient:
    def __init__(self, region=None):
        self.region = region or settings.RIOT_DEFAULT_REGION
        self.headers = {"X-Riot-Token": settings.RIOT_API_KEY}

    def get_valorant_matchlist(self, puuid, count=5):
        url = f"{_riot_base(self.region)}/val/match/v1/matchlists/by-puuid/{puuid}"
        resp = httpx.get(url, params={"start": 0, "count": count}, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_valorant_match(self, match_id):
        url = f"{_riot_base(self.region)}/val/match/v1/matches/{match_id}"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_account_by_riot_id(self, game_name, tag_line):
        url = f"{_riot_base(self.region)}/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_match_ids(self, puuid, count=5):
        url = f"{_riot_base(self.region)}/lol/match/v5/matches/by-puuid/{puuid}/ids"
        resp = httpx.get(url, params={"start": 0, "count": count}, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_match(self, match_id):
        url = f"{_riot_base(self.region)}/lol/match/v5/matches/{match_id}"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_timeline(self, match_id):
        url = f"{_riot_base(self.region)}/lol/match/v5/matches/{match_id}/timeline"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()


class FaceitClient:
    def __init__(self):
        self.headers = {"Authorization": f"Bearer {settings.FACEIT_API_KEY}"}

    def get_player_by_steam_id(self, steam_id):
        resp = httpx.get(
            f"{FACEIT_BASE}/players",
            params={"game": "cs2", "game_player_id": steam_id},
            headers=self.headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()

    def get_match_history(self, player_id, limit=5):
        resp = httpx.get(
            f"{FACEIT_BASE}/players/{player_id}/history",
            params={"game": "cs2", "offset": 0, "limit": limit},
            headers=self.headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()

    def get_match(self, match_id):
        resp = httpx.get(f"{FACEIT_BASE}/matches/{match_id}", headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_match_stats(self, match_id):
        resp = httpx.get(f"{FACEIT_BASE}/matches/{match_id}/stats", headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
