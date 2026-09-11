import logging
import random
import secrets
from datetime import date, datetime, timedelta, timezone

import httpx
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from apps.accounts.models import AuthSession, LinkedAccount, OAuthProvider, PasswordResetOtp, User, UserRole
from apps.accounts.password import hash_password, verify_password
from apps.accounts.token_encryption import decrypt_token, encrypt_token
from apps.core.exceptions import TikitakaException
from apps.core.jwt_service import generate_token
from apps.core.utils import first_non_blank, normalize_username, resolve_client_ip, resolve_user_agent

logger = logging.getLogger(__name__)

MINIMUM_AGE_YEARS = 13
EMAIL_EXISTS_MESSAGE = "An account with this email already exists. Sign in or reset your password."


def validate_age(date_of_birth):
    if not date_of_birth:
        raise TikitakaException("Date of birth is required", 400, "VALIDATION_ERROR")
    age = (date.today() - date_of_birth).days // 365
    if age < MINIMUM_AGE_YEARS:
        raise TikitakaException(
            f"You must be at least {MINIMUM_AGE_YEARS} years old to create an account",
            400,
            "AGE_REQUIREMENT",
        )


def issue_token(user):
    return {
        "token": generate_token(user),
        "email": user.email,
        "username": user.username,
        "role": user.role,
    }


def record_login(user, provider, request, location=None):
    ip = resolve_client_ip(request)
    loc = first_non_blank(location, resolve_location(ip))
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = ip
    if loc:
        user.location = loc
    user.save(update_fields=["last_login_at", "last_login_ip", "location", "updated_at"])
    AuthSession.objects.create(
        user=user,
        provider=provider,
        login_at=datetime.now(timezone.utc),
        ip_address=ip,
        user_agent=resolve_user_agent(request),
        location=loc,
    )


def record_logout(user_id):
    session = (
        AuthSession.objects.filter(user_id=user_id, logout_at__isnull=True)
        .order_by("-login_at")
        .first()
    )
    if session:
        session.logout_at = datetime.now(timezone.utc)
        session.save(update_fields=["logout_at"])


def resolve_location(ip):
    if not ip or ip.startswith("127.") or ip == "::1":
        return None
    try:
        resp = httpx.get(f"http://ip-api.com/json/{ip}?fields=city,country", timeout=3.0)
        data = resp.json()
        city = data.get("city")
        country = data.get("country")
        if city and country:
            return f"{city}, {country}"
    except Exception:
        pass
    return None


def resolve_user(identifier):
    value = identifier.strip()
    if "@" in value:
        user = User.objects.filter(email__iexact=value).first()
        if not user:
            raise TikitakaException("Invalid email or password", 401, "INVALID_CREDENTIALS")
        return user
    user = User.objects.filter(username__iexact=value).first()
    if not user:
        raise TikitakaException("Invalid username or password", 401, "INVALID_CREDENTIALS")
    return user


@transaction.atomic
def register_user(data, request):
    email = data["email"].strip().lower()
    if User.objects.filter(email__iexact=email).exists():
        raise TikitakaException(EMAIL_EXISTS_MESSAGE, 409, "EMAIL_EXISTS")

    username = normalize_username(data["username"])
    if len(username) < 3:
        raise TikitakaException("Username must be at least 3 characters", 400, "INVALID_USERNAME")
    if User.objects.filter(username__iexact=username).exists():
        raise TikitakaException("This username is already taken", 409, "USERNAME_EXISTS")

    dob = data.get("dateOfBirth")
    if isinstance(dob, str):
        dob = date.fromisoformat(dob)
    validate_age(dob)

    ip = resolve_client_ip(request)
    location = first_non_blank(data.get("location"), resolve_location(ip))

    user = User.objects.create(
        email=email,
        username=username,
        password_hash=hash_password(data["password"]),
        display_name=data["name"].strip(),
        date_of_birth=dob,
        location=location,
        role=UserRole.VIEWER,
    )
    record_login(user, None, request, location)
    return issue_token(user)


@transaction.atomic
def login_user(data, request):
    login_val = data.get("login") or data.get("email") or data.get("username") or data.get("identifier", "")
    user = resolve_user(login_val)

    if not user.password_hash:
        raise TikitakaException(
            "This account uses a linked provider. Sign in with Google, Riot, Steam, Faceit, or Epic, or reset your password to create one.",
            400,
            "PASSWORD_NOT_SET",
        )

    if not verify_password(data["password"], user.password_hash):
        raise TikitakaException("Invalid email or password", 401, "INVALID_CREDENTIALS")

    location = first_non_blank(data.get("location"), resolve_location(resolve_client_ip(request)))
    record_login(user, None, request, location)
    return issue_token(user)


def get_current_user(email):
    user = User.objects.filter(email=email).select_related().prefetch_related(
        "linked_accounts", "game_accounts__game"
    ).first()
    if not user:
        raise TikitakaException("User not found", 404, "USER_NOT_FOUND")

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "dateOfBirth": user.date_of_birth.isoformat() if user.date_of_birth else None,
        "location": user.location,
        "lastLoginAt": user.last_login_at.isoformat().replace("+00:00", "Z") if user.last_login_at else None,
        "role": user.role,
        "linkedAccounts": [
            {
                "provider": la.provider,
                "displayName": la.display_name,
                "avatarUrl": la.avatar_url,
                "linkedAt": la.created_at.isoformat().replace("+00:00", "Z"),
            }
            for la in user.linked_accounts.all()
        ],
        "gameAccounts": [
            {
                "gameId": ga.game_id,
                "gameName": ga.game.name,
                "externalPlayerId": ga.external_player_id,
            }
            for ga in user.game_accounts.select_related("game").all()
        ],
    }


def request_password_reset(email):
    email = email.strip().lower()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return
    if email.endswith("@linked.tikitaka"):
        return

    PasswordResetOtp.objects.filter(user=user, consumed_at__isnull=True).update(
        consumed_at=datetime.now(timezone.utc)
    )

    otp = f"{random.randint(0, 999999):06d}"
    PasswordResetOtp.objects.create(
        user=user,
        email=email,
        otp_hash=hash_password(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )

    if settings.EMAIL_HOST:
        send_mail(
            "TikiTaka Password Reset",
            f"Your password reset code is: {otp}\n\nThis code expires in 10 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
    else:
        logger.info("Password reset OTP for %s: %s", email, otp)


@transaction.atomic
def reset_password(data):
    email = data["email"].strip().lower()
    if email.endswith("@linked.tikitaka"):
        raise TikitakaException(
            "This account uses a linked provider. Sign in with your provider instead.",
            400,
            "PASSWORD_NOT_SET",
        )

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        raise TikitakaException("Invalid reset code", 400, "INVALID_OTP")

    otp_record = (
        PasswordResetOtp.objects.filter(user=user, consumed_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if not otp_record or otp_record.expires_at < datetime.now(timezone.utc):
        raise TikitakaException("Reset code has expired", 400, "OTP_EXPIRED")
    if not verify_password(data["otp"], otp_record.otp_hash):
        raise TikitakaException("Invalid reset code", 400, "INVALID_OTP")

    user.password_hash = hash_password(data["newPassword"])
    user.save(update_fields=["password_hash", "updated_at"])
    otp_record.consumed_at = datetime.now(timezone.utc)
    otp_record.save(update_fields=["consumed_at"])


def link_account(user, provider, provider_user_id, email=None, display_name=None, avatar_url=None,
                 access_token=None, refresh_token=None, token_expires_at=None):
    existing = LinkedAccount.objects.filter(provider=provider, provider_user_id=provider_user_id).exclude(user=user).first()
    if existing:
        raise TikitakaException(
            f"This {provider} account is already linked to another user",
            409,
            "ACCOUNT_ALREADY_LINKED",
        )

    la, _ = LinkedAccount.objects.update_or_create(
        user=user,
        provider=provider,
        defaults={
            "provider_user_id": provider_user_id,
            "email": email,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "access_token": encrypt_token(access_token) if access_token else None,
            "refresh_token": encrypt_token(refresh_token) if refresh_token else None,
            "token_expires_at": token_expires_at,
        },
    )
    return la


def unlink_account(user_id, provider):
    deleted, _ = LinkedAccount.objects.filter(user_id=user_id, provider=provider).delete()
    if not deleted:
        raise TikitakaException(f"No linked {provider} account found", 404, "LINK_NOT_FOUND")


def get_oauth_providers():
    return [p.value for p in OAuthProvider if is_provider_configured(p)]


def get_oauth_provider_status():
    return {p.value: is_provider_configured(p) for p in OAuthProvider}


def is_provider_configured(provider):
    mapping = {
        OAuthProvider.GOOGLE: lambda: settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET,
        OAuthProvider.RIOT: lambda: settings.RIOT_CLIENT_ID and settings.RIOT_CLIENT_SECRET,
        OAuthProvider.STEAM: lambda: bool(settings.STEAM_REDIRECT_URI),
        OAuthProvider.FACEIT: lambda: settings.FACEIT_CLIENT_ID and settings.FACEIT_CLIENT_SECRET,
        OAuthProvider.EPIC: lambda: settings.EPIC_CLIENT_ID and settings.EPIC_CLIENT_SECRET,
    }
    return bool(mapping.get(provider, lambda: False)())


def generate_unique_username(base):
    candidate = normalize_username(base)[:32] or "player"
    if not User.objects.filter(username__iexact=candidate).exists():
        return candidate
    for i in range(1, 1000):
        suffix = f"_{i}"
        trimmed = candidate[: 32 - len(suffix)] + suffix
        if not User.objects.filter(username__iexact=trimmed).exists():
            return trimmed
    return f"player_{secrets.token_hex(4)}"
