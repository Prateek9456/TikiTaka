import logging
from urllib.parse import quote

import httpx
from django.conf import settings

from apps.ingestion.errors import IngestionError
from apps.ingestion.riot_keys import normalize_riot_api_key

logger = logging.getLogger(__name__)

OPENDOTA_BASE = "https://api.opendota.com/api"
FACEIT_BASE = "https://open.faceit.com/data/v4"


ACCOUNT_ROUTING_REGIONS = frozenset({"americas", "asia", "europe"})
VALORANT_SHARDS = frozenset({"ap", "na", "eu", "kr", "latam", "br"})
ACCOUNT_REGION_TO_VALORANT_SHARD = {
    "americas": "na",
    "asia": "ap",
    "europe": "eu",
}


def _riot_base(region=None):
    return f"https://{region or settings.RIOT_DEFAULT_REGION}.api.riotgames.com"


def resolve_account_routing_region(metadata=None):
    if metadata:
        region = (metadata.get("region") or "").lower()
        if region in ACCOUNT_ROUTING_REGIONS:
            return region
    default = (settings.RIOT_DEFAULT_REGION or "americas").lower()
    if default in ACCOUNT_ROUTING_REGIONS:
        return default
    return "americas"


def resolve_valorant_shard(metadata=None):
    if metadata:
        shard = (metadata.get("valorant_shard") or metadata.get("valorantShard") or "").lower()
        if shard in VALORANT_SHARDS:
            return shard
    if settings.VALORANT_SHARD:
        return settings.VALORANT_SHARD.lower()
    account_region = resolve_account_routing_region(metadata)
    return ACCOUNT_REGION_TO_VALORANT_SHARD.get(account_region, "ap")


def normalize_riot_id_parts(game_name, tag_line):
    """Riot tags are sent without '#'; game names are trimmed."""
    return (game_name or "").strip(), (tag_line or "").strip().lstrip("#")


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
    def __init__(self, account_region=None, valorant_shard=None):
        self.account_region = account_region or settings.RIOT_DEFAULT_REGION
        self.valorant_shard = valorant_shard or resolve_valorant_shard()
        self.headers = {"X-Riot-Token": normalize_riot_api_key(settings.RIOT_API_KEY)}

    def _require_api_key(self):
        if not (settings.RIOT_API_KEY or "").strip():
            raise IngestionError(
                "Riot API key is not configured. Set RIOT_API_KEY in .env and restart the backend.",
                "RIOT_API_NOT_CONFIGURED",
            )

    def get_valorant_matchlist(self, puuid, count=5):
        self._require_api_key()
        url = f"{_riot_base(self.valorant_shard)}/val/match/v1/matchlists/by-puuid/{puuid}"
        resp = httpx.get(url, params={"start": 0, "count": count}, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_valorant_match(self, match_id):
        self._require_api_key()
        url = f"{_riot_base(self.valorant_shard)}/val/match/v1/matches/{match_id}"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_account_by_riot_id(self, game_name, tag_line):
        self._require_api_key()
        game_name, tag_line = normalize_riot_id_parts(game_name, tag_line)
        url = (
            f"{_riot_base(self.account_region)}/riot/account/v1/accounts/by-riot-id/"
            f"{quote(game_name, safe='')}/{quote(tag_line, safe='')}"
        )
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_match_ids(self, puuid, count=5):
        self._require_api_key()
        url = f"{_riot_base(self.account_region)}/lol/match/v5/matches/by-puuid/{puuid}/ids"
        resp = httpx.get(url, params={"start": 0, "count": count}, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_match(self, match_id):
        self._require_api_key()
        url = f"{_riot_base(self.account_region)}/lol/match/v5/matches/{match_id}"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_lol_timeline(self, match_id):
        self._require_api_key()
        url = f"{_riot_base(self.account_region)}/lol/match/v5/matches/{match_id}/timeline"
        resp = httpx.get(url, headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()


class FaceitClient:
    def __init__(self):
        self.headers = {"Authorization": f"Bearer {settings.FACEIT_API_KEY}"}

    def _require_api_key(self):
        if not (settings.FACEIT_API_KEY or "").strip():
            raise IngestionError(
                "Faceit API key is not configured. Set FACEIT_API_KEY in .env and restart the backend.",
                "FACEIT_API_NOT_CONFIGURED",
            )

    def get_player_by_steam_id(self, steam_id):
        self._require_api_key()
        resp = httpx.get(
            f"{FACEIT_BASE}/players",
            params={"game": "cs2", "game_player_id": steam_id},
            headers=self.headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()

    def get_player_by_nickname(self, nickname):
        self._require_api_key()
        resp = httpx.get(
            f"{FACEIT_BASE}/players",
            params={"nickname": nickname},
            headers=self.headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()

    def get_match_history(self, player_id, limit=5):
        self._require_api_key()
        resp = httpx.get(
            f"{FACEIT_BASE}/players/{player_id}/history",
            params={"game": "cs2", "offset": 0, "limit": limit},
            headers=self.headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()

    def get_match(self, match_id):
        self._require_api_key()
        resp = httpx.get(f"{FACEIT_BASE}/matches/{match_id}", headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()

    def get_match_stats(self, match_id):
        self._require_api_key()
        resp = httpx.get(f"{FACEIT_BASE}/matches/{match_id}/stats", headers=self.headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
