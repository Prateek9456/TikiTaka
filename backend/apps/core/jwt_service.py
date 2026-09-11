import base64
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings


def _signing_key():
    return base64.b64decode(settings.JWT_SECRET)


def generate_token(user):
    authorities = [f"ROLE_{user.role}"]
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.email,
        "authorities": authorities,
        "iat": now,
        "exp": now + timedelta(milliseconds=settings.JWT_EXPIRATION_MS),
    }
    return jwt.encode(payload, _signing_key(), algorithm=settings.JWT_ALGORITHM)


def decode_token(token):
    return jwt.decode(token, _signing_key(), algorithms=[settings.JWT_ALGORITHM])


def extract_email(token):
    return decode_token(token)["sub"]
