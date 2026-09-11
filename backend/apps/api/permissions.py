from apps.core.exceptions import TikitakaException


def require_user(request):
    user = getattr(request, "tikitaka_user", None)
    if not user:
        raise TikitakaException("Authentication is required", 401, "UNAUTHORIZED")
    return user


def require_role(user, *roles):
    if user.role not in roles:
        raise TikitakaException(
            "You do not have permission to access this resource",
            403,
            "ACCESS_DENIED",
        )
