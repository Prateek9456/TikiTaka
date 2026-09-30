import base64
import secrets

from django.conf import settings
from django.core.cache import cache

STATE_COOKIE = "oauth_state"
LINK_USER_COOKIE = "oauth_link_user"
REDIS_KEY_PREFIX = "oauth:state:"
STATE_TTL = 600  # 10 minutes


def generate_state_token():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii").rstrip("=")


def attach_oauth_state_cookies(response, state, link_user_id=None):
    payload = str(link_user_id) if link_user_id else ""
    cache.set(f"{REDIS_KEY_PREFIX}{state}", payload, STATE_TTL)

    response.set_cookie(
        STATE_COOKIE,
        state,
        max_age=STATE_TTL,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    if link_user_id:
        response.set_cookie(
            LINK_USER_COOKIE,
            str(link_user_id),
            max_age=STATE_TTL,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
        )
    return state


def create_state(response, link_user_id=None):
    return attach_oauth_state_cookies(response, generate_state_token(), link_user_id)


def _read_cookie(request, name):
    return request.COOKIES.get(name)


def resolve_state_token(request):
    state = request.GET.get("state")
    if state:
        return state
    return _read_cookie(request, STATE_COOKIE)


def validate_state(state, request):
    redis_key = f"{REDIS_KEY_PREFIX}{state}"
    redis_payload = cache.get(redis_key)
    if redis_payload is not None:
        cache.delete(redis_key)

    cookie_state = _read_cookie(request, STATE_COOKIE)

    redis_valid = bool(state) and redis_payload is not None
    cookie_valid = cookie_state and cookie_state == state
    if not redis_valid and not cookie_valid:
        from apps.core.exceptions import TikitakaException

        raise TikitakaException("Invalid OAuth state", 400, "OAUTH_STATE_INVALID")

    link_user_id = redis_payload if redis_payload else _read_cookie(request, LINK_USER_COOKIE)
    request.oauth_link_user_id = link_user_id if link_user_id else None


def consume_link_user_id(request):
    link_user_id = getattr(request, "oauth_link_user_id", None) or _read_cookie(request, LINK_USER_COOKIE)
    if not link_user_id:
        return None
    try:
        return int(link_user_id)
    except ValueError:
        from apps.core.exceptions import TikitakaException

        raise TikitakaException("Invalid OAuth link session", 400, "OAUTH_LINK_INVALID")


def clear_oauth_cookies(response):
    response.delete_cookie(STATE_COOKIE, path="/")
    response.delete_cookie(LINK_USER_COOKIE, path="/")
