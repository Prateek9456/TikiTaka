import re


def resolve_client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def resolve_user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")


def normalize_username(username):
    return re.sub(r"[^A-Za-z0-9_]", "", (username or "").strip())


def first_non_blank(*values):
    for v in values:
        if v and str(v).strip():
            return str(v).strip()
    return None
