"""Riot API key helpers and account resolution."""

import logging
import time
from urllib.parse import quote

import httpx
from django.conf import settings

from apps.ingestion.clients import (
    ACCOUNT_REGION_TO_VALORANT_SHARD,
    ACCOUNT_ROUTING_REGIONS,
    RiotApiClient,
    _riot_base,
    normalize_riot_id_parts,
    resolve_account_routing_region,
    resolve_valorant_shard,
)
from apps.ingestion.errors import IngestionError

logger = logging.getLogger(__name__)

_KEY_PROBE_CACHE = {"checked_at": 0.0, "healthy": False, "detail": ""}
_KEY_PROBE_TTL_SECONDS = 60


from apps.ingestion.riot_keys import normalize_riot_api_key

def ordered_account_regions(preferred: str | None = None) -> list[str]:
    preferred = (preferred or settings.RIOT_DEFAULT_REGION or "americas").lower()
    if preferred not in ACCOUNT_ROUTING_REGIONS:
        preferred = "americas"
    return [preferred] + [r for r in sorted(ACCOUNT_ROUTING_REGIONS) if r != preferred]


def fetch_account_by_riot_id(game_name: str, tag_line: str, preferred_region: str | None = None):
    """
    Resolve a Riot account across routing clusters (americas / europe / asia).
    Returns (account_json, routing_region).
    """
    game_name, tag_line = normalize_riot_id_parts(game_name, tag_line)
    auth_error = None
    not_found_regions: list[str] = []

    for region in ordered_account_regions(preferred_region):
        client = RiotApiClient(account_region=region, valorant_shard=None)
        url = (
            f"{_riot_base(region)}/riot/account/v1/accounts/by-riot-id/"
            f"{quote(game_name, safe='')}/{quote(tag_line, safe='')}"
        )
        try:
            resp = httpx.get(url, headers=client.headers, timeout=30.0)
            resp.raise_for_status()
            return resp.json(), region
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403):
                auth_error = exc
                break
            if status == 404:
                not_found_regions.append(region)
                continue
            raise

    if auth_error is not None:
        raise auth_error

    raise IngestionError(
        f"Could not find {game_name}#{tag_line} in Riot account clusters "
        f"(tried: {', '.join(not_found_regions) or 'americas, europe, asia'}). "
        "Check the name and tag spelling.",
        "RIOT_ID_NOT_FOUND",
    )


def probe_riot_api_key(preferred_region: str | None = None) -> dict:
    """
    Check whether RIOT_API_KEY is accepted by Riot (404 on a fake ID = key works).
    """
    if not settings.RIOT_API_KEY:
        return {
            "configured": False,
            "healthy": False,
            "httpStatus": None,
            "message": "RIOT_API_KEY is not set in .env.",
        }

    region = (preferred_region or settings.RIOT_DEFAULT_REGION or "americas").lower()
    if region not in ACCOUNT_ROUTING_REGIONS:
        region = "americas"

    url = f"{_riot_base(region)}/riot/account/v1/accounts/by-riot-id/NotAPlayer/00000"
    headers = {"X-Riot-Token": settings.RIOT_API_KEY}
    try:
        resp = httpx.get(url, headers=headers, timeout=15.0)
    except httpx.HTTPError as exc:
        return {
            "configured": True,
            "healthy": False,
            "httpStatus": None,
            "message": f"Could not reach Riot API: {exc}",
        }

    if resp.status_code == 404:
        return {
            "configured": True,
            "healthy": True,
            "httpStatus": 404,
            "message": "Riot API key is valid.",
            "routingRegion": region,
        }
    if resp.status_code in (401, 403):
        return {
            "configured": True,
            "healthy": False,
            "httpStatus": resp.status_code,
            "message": (
                f"Riot rejected your API key (HTTP {resp.status_code}). "
                "Regenerate a development key or use your Personal/Production key from "
                "developer.riotgames.com → your registered product, then update RIOT_API_KEY "
                "and run: docker compose up -d django-backend"
            ),
        }
    return {
        "configured": True,
        "healthy": False,
        "httpStatus": resp.status_code,
        "message": f"Unexpected Riot API response (HTTP {resp.status_code}).",
    }


def cached_riot_api_probe() -> dict:
    now = time.time()
    if now - _KEY_PROBE_CACHE["checked_at"] < _KEY_PROBE_TTL_SECONDS:
        return {
            "configured": bool(settings.RIOT_API_KEY),
            "healthy": _KEY_PROBE_CACHE["healthy"],
            "message": _KEY_PROBE_CACHE["detail"],
        }
    result = probe_riot_api_key()
    _KEY_PROBE_CACHE["checked_at"] = now
    _KEY_PROBE_CACHE["healthy"] = result.get("healthy", False)
    _KEY_PROBE_CACHE["detail"] = result.get("message", "")
    return result


def build_riot_link_metadata(game_name: str, tag_line: str, routing_region: str) -> dict:
    routing_region = routing_region.lower()
    shard = ACCOUNT_REGION_TO_VALORANT_SHARD.get(routing_region) or resolve_valorant_shard({"region": routing_region})
    return {
        "region": routing_region,
        "valorant_shard": shard,
        "riot-id": f"{game_name}#{tag_line}",
    }


def probe_valorant_match_access(puuid: str, metadata: dict | None) -> dict:
    """Optional check after link: can this key read Valorant matchlists?"""
    if not puuid:
        return {"allowed": False, "httpStatus": None, "message": "No PUUID."}
    client = RiotApiClient(
        account_region=resolve_account_routing_region(metadata),
        valorant_shard=resolve_valorant_shard(metadata),
    )
    url = f"{_riot_base(client.valorant_shard)}/val/match/v1/matchlists/by-puuid/{puuid}"
    try:
        resp = httpx.get(url, params={"start": 0, "count": 1}, headers=client.headers, timeout=30.0)
    except httpx.HTTPError as exc:
        return {"allowed": False, "httpStatus": None, "message": str(exc)}
    if resp.status_code == 200:
        return {"allowed": True, "httpStatus": 200, "message": "Valorant match API accessible."}
    if resp.status_code == 401:
        return {
            "allowed": False,
            "httpStatus": 401,
            "message": "Riot API key rejected (401). Update RIOT_API_KEY and restart the backend.",
        }
    if resp.status_code == 403:
        return {
            "allowed": False,
            "httpStatus": 403,
            "message": (
                "This API key cannot read Valorant match history (403). "
                "Development keys often lack Valorant access—use a Personal API key from your "
                "registered product at developer.riotgames.com."
            ),
        }
    return {
        "allowed": False,
        "httpStatus": resp.status_code,
        "message": f"Valorant match API returned HTTP {resp.status_code}.",
    }
