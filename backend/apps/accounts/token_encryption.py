import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings

ENC_PREFIX = "enc:"


def _get_key():
    key_b64 = settings.OAUTH_TOKEN_ENCRYPTION_KEY
    if not key_b64:
        return None
    return base64.b64decode(key_b64)


def encrypt_token(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    key = _get_key()
    if key is None:
        return plaintext
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return ENC_PREFIX + base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_token(stored: str) -> str:
    if not stored:
        return stored
    if not stored.startswith(ENC_PREFIX):
        return stored
    key = _get_key()
    if key is None:
        return stored[len(ENC_PREFIX) :]
    raw = base64.b64decode(stored[len(ENC_PREFIX) :])
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
