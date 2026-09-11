from datetime import datetime, timezone

from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view

from apps.accounts.models import OAuthProvider
from apps.accounts.oauth_service import (
    _oauth_error_redirect,
    handle_epic_callback,
    handle_faceit_callback,
    handle_google_callback,
    handle_riot_callback,
    handle_steam_callback,
    start_oauth,
)
from apps.accounts.services import (
    get_current_user,
    get_oauth_provider_status,
    get_oauth_providers,
    login_user,
    record_logout,
    register_user,
    request_password_reset,
    reset_password,
    unlink_account,
)
from apps.api.permissions import require_role, require_user
from apps.api.services import (
    get_auth_sessions,
    get_game_sessions,
    get_latest_match,
    get_leaderboard,
    get_match_analysis,
    list_games,
    list_patterns,
)
from apps.core.exceptions import TikitakaException
from apps.core.responses import api_error, api_success


@api_view(["POST"])
def register(request):
    return api_success(register_user(request.data, request), "Registration successful")


@api_view(["POST"])
def login(request):
    return api_success(login_user(request.data, request))


@ensure_csrf_cookie
@api_view(["GET"])
def csrf_token(request):
    token = get_token(request)
    return api_success({
        "token": token,
        "headerName": "X-XSRF-TOKEN",
        "cookieName": "XSRF-TOKEN",
    })


@api_view(["POST"])
def forgot_password(request):
    request_password_reset(request.data.get("email", ""))
    return api_success(None, "If an account exists for that email, a reset code has been sent.")


@api_view(["POST"])
def reset_password_view(request):
    reset_password(request.data)
    return api_success(None, "Password updated. You can now sign in with your new password.")


@api_view(["POST"])
def logout(request):
    user = require_user(request)
    record_logout(user.id)
    return api_success(None, "Logged out successfully")


@api_view(["GET"])
def me(request):
    user = require_user(request)
    return api_success(get_current_user(user.email))


@api_view(["GET"])
def oauth_providers(request):
    return api_success(get_oauth_providers())


@api_view(["GET"])
def oauth_provider_status(request):
    return api_success(get_oauth_provider_status())


def _parse_provider(provider_str):
    try:
        return OAuthProvider(provider_str.upper())
    except ValueError:
        raise TikitakaException(f"Unknown OAuth provider: {provider_str}", 400, "INVALID_PROVIDER")


@api_view(["POST", "DELETE"])
def link_provider(request, provider):
    user = require_user(request)
    oauth_provider = _parse_provider(provider)
    if request.method == "DELETE":
        unlink_account(user.id, oauth_provider.value)
        return api_success(None, f"{oauth_provider.value} unlinked successfully")
    return start_oauth(oauth_provider, request._request, link_user_id=user.id)


@api_view(["DELETE"])
def unlink_provider(request, provider):
    user = require_user(request)
    oauth_provider = _parse_provider(provider)
    unlink_account(user.id, oauth_provider.value)
    return api_success(None, f"{oauth_provider.value} unlinked successfully")


@api_view(["GET"])
def oauth_start(request, provider):
    oauth_provider = _parse_provider(provider)
    return start_oauth(oauth_provider, request._request)


@api_view(["GET"])
def oauth_callback(request, provider):
    error = request.GET.get("error")
    if error:
        return _oauth_error_redirect("OAUTH_DENIED", request.GET.get("error_description", "OAuth denied"))

    try:
        oauth_provider = _parse_provider(provider)
        state = request.GET.get("state", "")

        if oauth_provider == OAuthProvider.GOOGLE:
            return handle_google_callback(request.GET.get("code"), state, request, request._request)
        if oauth_provider == OAuthProvider.RIOT:
            return handle_riot_callback(request.GET.get("code"), state, request, request._request)
        if oauth_provider == OAuthProvider.FACEIT:
            return handle_faceit_callback(request.GET.get("code"), state, request, request._request)
        if oauth_provider == OAuthProvider.EPIC:
            return handle_epic_callback(request.GET.get("code"), state, request, request._request)
        if oauth_provider == OAuthProvider.STEAM:
            return handle_steam_callback(request, request._request)
    except TikitakaException as exc:
        return _oauth_error_redirect(exc.code, exc.message)
    except Exception as exc:
        return _oauth_error_redirect("OAUTH_FAILED", str(exc))

    return _oauth_error_redirect("INVALID_PROVIDER", f"Unknown provider: {provider}")


@api_view(["GET"])
def games_list(request):
    return api_success(list_games())


@api_view(["GET"])
def patterns_list(request):
    game_id = request.GET.get("gameId")
    if not game_id:
        raise TikitakaException("gameId is required", 400, "VALIDATION_ERROR")
    sort_by = request.GET.get("sortBy", "winRate")
    page = int(request.GET.get("page", 0))
    size = int(request.GET.get("size", 20))
    return api_success(list_patterns(int(game_id), sort_by, page, size))


@api_view(["GET"])
def leaderboard(request):
    user = require_user(request)
    game_id = request.GET.get("gameId")
    if not game_id:
        raise TikitakaException("gameId is required", 400, "VALIDATION_ERROR")
    metric = request.GET.get("metric", "tikitaka_score")
    return api_success(get_leaderboard(user.id, int(game_id), metric))


@api_view(["GET"])
def latest_match(request):
    user = require_user(request)
    game_id = request.GET.get("gameId")
    if not game_id:
        raise TikitakaException("gameId is required", 400, "VALIDATION_ERROR")
    try:
        return api_success(get_latest_match(user.id, int(game_id)))
    except TikitakaException as exc:
        if exc.status_code == 404:
            return api_error("NOT_FOUND", exc.message, 404)
        raise


@api_view(["GET"])
def match_analysis(request, match_id):
    user = require_user(request)
    return api_success(get_match_analysis(user.id, int(match_id)))


@api_view(["GET"])
def auth_sessions(request):
    user = require_user(request)
    return api_success(get_auth_sessions(user.id))


@api_view(["GET"])
def game_sessions(request):
    user = require_user(request)
    game_id = request.GET.get("gameId")
    from_str = request.GET.get("from")
    to_str = request.GET.get("to")

    from_dt = datetime.fromisoformat(from_str.replace("Z", "+00:00")) if from_str else None
    to_dt = datetime.fromisoformat(to_str.replace("Z", "+00:00")) if to_str else None

    return api_success(
        get_game_sessions(user.id, int(game_id) if game_id else None, from_dt, to_dt)
    )


@api_view(["POST"])
def ingest_trigger(request):
    user = require_user(request)
    require_role(user, "ANALYST", "ADMIN")
    from apps.ingestion.services import trigger_ingestion
    return api_success(trigger_ingestion(request.data))


@api_view(["POST"])
def ingest_trigger_match(request):
    user = require_user(request)
    require_role(user, "ANALYST", "ADMIN")
    from apps.ingestion.services import trigger_single_match
    return api_success(trigger_single_match(request.data))


@api_view(["POST"])
def ingest_trigger_game(request, game_slug):
    user = require_user(request)
    require_role(user, "ANALYST", "ADMIN")
    limit = int(request.GET.get("limit", 5))
    from apps.ingestion.services import trigger_game_ingestion
    return api_success(trigger_game_ingestion(game_slug, limit))


@api_view(["POST"])
def ingest_me_sync(request):
    user = require_user(request)
    from apps.ingestion.services import sync_user_matches
    game_id = request.data.get("gameId")
    limit = int(request.data.get("limit", 5))
    return api_success(sync_user_matches(user.id, game_id, limit))


@api_view(["GET"])
def ingest_status(request):
    require_user(request)
    from apps.ingestion.services import get_fetch_logs
    game_id = request.GET.get("gameId")
    limit = int(request.GET.get("limit", 10))
    return api_success(get_fetch_logs(int(game_id) if game_id else None, limit))


@api_view(["GET"])
def ingest_scheduler(request):
    require_user(request)
    from apps.ingestion.services import get_scheduler_info
    return api_success(get_scheduler_info())
