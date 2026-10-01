import base64
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.db import transaction
from django.http import HttpResponseRedirect

from apps.accounts.models import OAuthProvider, User
from apps.accounts.oauth_state import (
    clear_oauth_cookies,
    consume_link_user_id,
    create_state,
    resolve_state_token,
    validate_state,
)
from apps.accounts.services import (
    generate_unique_username,
    is_provider_configured,
    issue_token,
    link_account,
    record_login,
)
from apps.core.exceptions import TikitakaException

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

RIOT_AUTH_URL = "https://auth.riotgames.com/authorize"
RIOT_TOKEN_URL = "https://auth.riotgames.com/token"
RIOT_USERINFO_URL = "https://auth.riotgames.com/userinfo"

FACEIT_AUTH_URL = "https://accounts.faceit.com/accounts"
FACEIT_TOKEN_URL = "https://api.faceit.com/auth/v1/oauth/token"
FACEIT_USERINFO_URL = "https://api.faceit.com/auth/v1/resources/userinfo"

EPIC_AUTH_URL = "https://www.epicgames.com/id/authorize"
EPIC_TOKEN_URL = "https://api.epicgames.dev/epic/oauth/v2/token"
EPIC_USERINFO_URL = "https://api.epicgames.dev/epic/oauth/v2/userInfo"

STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"


def _require_configured(provider):
    if not is_provider_configured(provider):
        raise TikitakaException(
            f"{provider.value} OAuth is not configured",
            503,
            "OAUTH_NOT_CONFIGURED",
        )


def _oauth_error_redirect(error_code, message):
    response = HttpResponseRedirect(
        f"{settings.OAUTH_FRONTEND_LOGIN_URL}?error={error_code}&message={message}"
    )
    clear_oauth_cookies(response)
    return response


def _complete_login_redirect(user):
    token = issue_token(user)["token"]
    response = HttpResponseRedirect(f"{settings.OAUTH_FRONTEND_REDIRECT_URL}?token={token}")
    clear_oauth_cookies(response)
    return response


def _complete_link_redirect(provider):
    response = HttpResponseRedirect(f"{settings.OAUTH_LINK_REDIRECT_URL}?linked={provider.lower()}")
    clear_oauth_cookies(response)
    return response


def _oauth_authorize_url(provider, response, link_user_id=None):
    """Set OAuth state cookies on ``response`` and return the provider authorize URL."""
    if provider == OAuthProvider.GOOGLE:
        state = create_state(response, link_user_id)
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    if provider == OAuthProvider.RIOT:
        state = create_state(response, link_user_id)
        params = {
            "client_id": settings.RIOT_CLIENT_ID,
            "redirect_uri": settings.RIOT_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid cpid",
            "state": state,
        }
        return f"{RIOT_AUTH_URL}?{urlencode(params)}"

    if provider == OAuthProvider.FACEIT:
        state = create_state(response, link_user_id)
        params = {
            "response_type": "code",
            "client_id": settings.FACEIT_CLIENT_ID,
            "redirect_uri": settings.FACEIT_REDIRECT_URI,
            "scope": "openid profile",
            "state": state,
            "redirect_popup": "true",
        }
        return f"{FACEIT_AUTH_URL}?{urlencode(params)}"

    if provider == OAuthProvider.EPIC:
        state = create_state(response, link_user_id)
        params = {
            "client_id": settings.EPIC_CLIENT_ID,
            "redirect_uri": settings.EPIC_REDIRECT_URI,
            "response_type": "code",
            "scope": "basic_profile",
            "state": state,
        }
        return f"{EPIC_AUTH_URL}?{urlencode(params)}"

    if provider == OAuthProvider.STEAM:
        create_state(response, link_user_id)
        params = {
            "openid.ns": "http://specs.openid.net/auth/2.0",
            "openid.mode": "checkid_setup",
            "openid.return_to": settings.STEAM_REDIRECT_URI,
            "openid.realm": settings.STEAM_REALM,
            "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
            "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        }
        return f"{STEAM_OPENID_URL}?{urlencode(params)}"

    raise TikitakaException(f"Unknown provider: {provider}", 400, "INVALID_PROVIDER")


def start_oauth(provider, link_user_id=None):
    _require_configured(provider)
    response = HttpResponseRedirect("/")
    response["Location"] = _oauth_authorize_url(provider, response, link_user_id)
    return response


def prepare_oauth_link_start(provider, link_user_id):
    """
    Build provider authorize URL and OAuth state cookies for account linking.

    Returns (redirect_url, cookie_carrier) where cookie_carrier is an HttpResponse
    whose cookies must be copied onto the API response (link flow cannot use 302
    from XHR because browsers hide cross-origin redirect targets).
    """
    from django.http import HttpResponse

    _require_configured(provider)
    cookie_carrier = HttpResponse()
    redirect_url = _oauth_authorize_url(provider, cookie_carrier, link_user_id)
    return redirect_url, cookie_carrier


def _basic_auth_header(client_id, client_secret):
    token = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def _exchange_code(token_url, data, headers=None):
    resp = httpx.post(token_url, data=data, headers=headers or {}, timeout=15.0)
    if resp.status_code != 200:
        raise TikitakaException("OAuth token exchange failed", 400, "OAUTH_FAILED")
    return resp.json()


def _fetch_userinfo(url, access_token):
    resp = httpx.get(url, headers={"Authorization": f"Bearer {access_token}"}, timeout=15.0)
    if resp.status_code != 200:
        raise TikitakaException("Failed to fetch OAuth profile", 400, "OAUTH_PROFILE_INCOMPLETE")
    return resp.json()


@transaction.atomic
def handle_google_callback(code, state, request):
    validate_state(state, request)
    link_user_id = consume_link_user_id(request)

    token_data = _exchange_code(
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
    )
    userinfo = _fetch_userinfo(GOOGLE_USERINFO_URL, token_data["access_token"])
    sub = userinfo.get("sub")
    email = userinfo.get("email")
    if not sub or not email:
        raise TikitakaException("Google account is missing required profile fields", 400, "OAUTH_PROFILE_INCOMPLETE")

    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])

    if link_user_id:
        user = User.objects.get(id=link_user_id)
        link_account(
            user, OAuthProvider.GOOGLE, sub, email,
            userinfo.get("name"), userinfo.get("picture"),
            token_data.get("access_token"), token_data.get("refresh_token"), expires_at,
        )
        return _complete_link_redirect("google")

    user = _find_or_create_oauth_user(
        OAuthProvider.GOOGLE, sub, email,
        userinfo.get("name"), userinfo.get("picture"),
        token_data.get("access_token"), token_data.get("refresh_token"), expires_at,
    )
    record_login(user, OAuthProvider.GOOGLE, request)
    return _complete_login_redirect(user)


@transaction.atomic
def handle_riot_callback(code, state, request):
    validate_state(state, request)
    link_user_id = consume_link_user_id(request)

    token_data = _exchange_code(
        RIOT_TOKEN_URL,
        {
            "code": code,
            "client_id": settings.RIOT_CLIENT_ID,
            "client_secret": settings.RIOT_CLIENT_SECRET,
            "redirect_uri": settings.RIOT_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
    )
    userinfo = _fetch_userinfo(RIOT_USERINFO_URL, token_data["access_token"])
    sub = userinfo.get("sub")
    if not sub:
        raise TikitakaException("Riot account is missing required profile fields", 400, "OAUTH_PROFILE_INCOMPLETE")

    email = f"riot-{sub}@linked.tikitaka"
    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])

    if link_user_id:
        user = User.objects.get(id=link_user_id)
        link_account(user, OAuthProvider.RIOT, sub, email, sub, None,
                     token_data.get("access_token"), token_data.get("refresh_token"), expires_at)
        _link_riot_game_accounts(user, sub)
        _queue_initial_match_sync(user.id)
        return _complete_link_redirect("riot")

    user = _find_or_create_oauth_user(
        OAuthProvider.RIOT, sub, email, sub, None,
        token_data.get("access_token"), token_data.get("refresh_token"), expires_at,
    )
    _link_riot_game_accounts(user, sub)
    _queue_initial_match_sync(user.id)
    record_login(user, OAuthProvider.RIOT, request)
    return _complete_login_redirect(user)


@transaction.atomic
def handle_faceit_callback(code, state, request):
    validate_state(state, request)
    link_user_id = consume_link_user_id(request)

    token_data = _exchange_code(
        FACEIT_TOKEN_URL,
        {
            "code": code,
            "redirect_uri": settings.FACEIT_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        headers=_basic_auth_header(settings.FACEIT_CLIENT_ID, settings.FACEIT_CLIENT_SECRET),
    )
    userinfo = _fetch_userinfo(FACEIT_USERINFO_URL, token_data["access_token"])
    sub = userinfo.get("sub") or userinfo.get("guid")
    nickname = userinfo.get("nickname") or userinfo.get("name")
    if not sub:
        raise TikitakaException("Faceit account is missing required profile fields", 400, "OAUTH_PROFILE_INCOMPLETE")

    email = userinfo.get("email") or f"faceit-{sub}@linked.tikitaka"
    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])

    if link_user_id:
        user = User.objects.get(id=link_user_id)
        link_account(user, OAuthProvider.FACEIT, sub, email, nickname, userinfo.get("picture"),
                     token_data.get("access_token"), token_data.get("refresh_token"), expires_at)
        _link_faceit_game_account(user, sub)
        return _complete_link_redirect("faceit")

    user = _find_or_create_oauth_user(
        OAuthProvider.FACEIT, sub, email, nickname, userinfo.get("picture"),
        token_data.get("access_token"), token_data.get("refresh_token"), expires_at,
    )
    _link_faceit_game_account(user, sub)
    record_login(user, OAuthProvider.FACEIT, request)
    return _complete_login_redirect(user)


@transaction.atomic
def handle_epic_callback(code, state, request):
    validate_state(state, request)
    link_user_id = consume_link_user_id(request)

    epic_data = {
        "code": code,
        "redirect_uri": settings.EPIC_REDIRECT_URI,
        "grant_type": "authorization_code",
        "scope": "basic_profile",
    }
    if settings.EPIC_DEPLOYMENT_ID:
        epic_data["deployment_id"] = settings.EPIC_DEPLOYMENT_ID

    token_data = _exchange_code(
        EPIC_TOKEN_URL,
        epic_data,
        headers=_basic_auth_header(settings.EPIC_CLIENT_ID, settings.EPIC_CLIENT_SECRET),
    )
    userinfo = _fetch_userinfo(EPIC_USERINFO_URL, token_data["access_token"])
    sub = userinfo.get("sub")
    display_name = userinfo.get("displayName") or userinfo.get("name")
    if not sub:
        raise TikitakaException("Epic account is missing required profile fields", 400, "OAUTH_PROFILE_INCOMPLETE")

    email = userinfo.get("email") or f"epic-{sub}@linked.tikitaka"
    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])

    if link_user_id:
        user = User.objects.get(id=link_user_id)
        link_account(user, OAuthProvider.EPIC, sub, email, display_name, None,
                     token_data.get("access_token"), token_data.get("refresh_token"), expires_at)
        return _complete_link_redirect("epic")

    user = _find_or_create_oauth_user(
        OAuthProvider.EPIC, sub, email, display_name, None,
        token_data.get("access_token"), token_data.get("refresh_token"), expires_at,
    )
    record_login(user, OAuthProvider.EPIC, request)
    return _complete_login_redirect(user)


def _verify_steam_openid(request):
    params = {k: v for k, v in request.GET.items() if k.startswith("openid.")}
    mode = params.get("openid.mode")
    if mode != "id_res":
        raise TikitakaException(f"Steam OpenID response mode invalid: {mode}", 400, "OAUTH_CALLBACK_INVALID")

    verify_params = dict(params)
    verify_params["openid.mode"] = "check_authentication"
    resp = httpx.post(STEAM_OPENID_URL, data=verify_params, timeout=15.0)
    if "is_valid:true" not in resp.text:
        raise TikitakaException("Steam OpenID verification failed", 400, "OAUTH_VERIFICATION_FAILED")

    claimed_id = params.get("openid.claimed_id", "")
    match = re.search(r"https://steamcommunity.com/openid/id/(\d+)", claimed_id)
    if not match:
        raise TikitakaException("Steam OpenID response missing claimed_id", 400, "OAUTH_PROFILE_INCOMPLETE")
    return match.group(1)


def _fetch_steam_profile(steam_id):
    email = f"steam-{steam_id}@linked.tikitaka"
    if not settings.STEAM_API_KEY:
        return None, None, email
    resp = httpx.get(
        "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
        params={"key": settings.STEAM_API_KEY, "steamids": steam_id},
        timeout=15.0,
    )
    data = resp.json()
    players = data.get("response", {}).get("players", [])
    if players:
        player = players[0]
        return player.get("personaname"), player.get("avatarfull"), email
    return None, None, email


@transaction.atomic
def handle_steam_callback(request):
    state = resolve_state_token(request)
    if not state:
        raise TikitakaException("Missing OAuth callback parameters", 400, "OAUTH_CALLBACK_INVALID")
    validate_state(state, request)
    link_user_id = consume_link_user_id(request)

    steam_id = _verify_steam_openid(request)
    display_name, avatar_url, email = _fetch_steam_profile(steam_id)

    if link_user_id:
        user = User.objects.get(id=link_user_id)
        link_account(user, OAuthProvider.STEAM, steam_id, email, display_name, avatar_url, None, None, None)
        _link_steam_game_accounts(user, steam_id)
        return _complete_link_redirect("steam")

    user = _find_or_create_oauth_user(
        OAuthProvider.STEAM, steam_id, email, display_name, avatar_url, None, None, None
    )
    _link_steam_game_accounts(user, steam_id)
    record_login(user, OAuthProvider.STEAM, request)
    return _complete_login_redirect(user)


def _find_or_create_oauth_user(provider, provider_user_id, email, display_name, avatar_url,
                                access_token, refresh_token, token_expires_at):
    from apps.accounts.models import LinkedAccount

    existing = LinkedAccount.objects.filter(provider=provider, provider_user_id=provider_user_id).select_related("user").first()
    if existing:
        link_account(existing.user, provider, provider_user_id, email, display_name, avatar_url,
                     access_token, refresh_token, token_expires_at)
        return existing.user

    user_by_email = User.objects.filter(email__iexact=email).first()
    if user_by_email:
        link_account(user_by_email, provider, provider_user_id, email, display_name, avatar_url,
                     access_token, refresh_token, token_expires_at)
        return user_by_email

    username = generate_unique_username(display_name or email.split("@")[0])
    user = User.objects.create(
        email=email.lower(),
        username=username,
        display_name=display_name,
        avatar_url=avatar_url,
        role="VIEWER",
    )
    link_account(user, provider, provider_user_id, email, display_name, avatar_url,
                 access_token, refresh_token, token_expires_at)
    return user


def _queue_initial_match_sync(user_id):
    try:
        from apps.ingestion.tasks import sync_user_matches_task

        sync_user_matches_task.delay(user_id, limit=10)
    except Exception as exc:
        logger.warning("Could not queue initial match sync for user %s: %s", user_id, exc)


def _link_riot_game_accounts(user, puuid):
    from apps.accounts.models import UserGameAccount
    from apps.games.models import Game
    from apps.ingestion.clients import resolve_valorant_shard

    account_region = (settings.RIOT_DEFAULT_REGION or "americas").lower()
    metadata = {
        "region": account_region,
        "valorant_shard": resolve_valorant_shard({"region": account_region}),
    }

    for game_id in (3, 4):  # valorant, lol
        game = Game.objects.filter(id=game_id).first()
        if game:
            UserGameAccount.objects.update_or_create(
                user=user, game=game,
                defaults={"external_player_id": puuid, "metadata": metadata},
            )


def _link_faceit_game_account(user, faceit_id):
    from apps.accounts.models import UserGameAccount
    from apps.games.models import Game

    game = Game.objects.filter(id=2).first()  # cs2
    if game:
        UserGameAccount.objects.update_or_create(
            user=user, game=game,
            defaults={"external_player_id": faceit_id, "metadata": {"faceit-id": faceit_id}},
        )


def _link_steam_game_accounts(user, steam_id):
    from apps.accounts.models import UserGameAccount
    from apps.games.models import Game

    dota_account_id = str(int(steam_id) - 76561197960265728)
    for game_id, ext_id, meta in [
        (1, dota_account_id, {"steam-id": steam_id}),
        (2, steam_id, {"steam-id": steam_id}),
    ]:
        game = Game.objects.filter(id=game_id).first()
        if game:
            UserGameAccount.objects.update_or_create(
                user=user, game=game,
                defaults={"external_player_id": ext_id, "metadata": meta},
            )
