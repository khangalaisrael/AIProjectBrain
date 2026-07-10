"""Symmetric encryption for third-party secrets stored in the database.

GitHub access tokens are written encrypted and decrypted only when they are
about to be used. The key never lives in source — see ``TOKEN_ENCRYPTION_KEY``.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class TokenCipherUnavailable(RuntimeError):
    """Raised when TOKEN_ENCRYPTION_KEY is missing or malformed."""


@lru_cache
def _cipher() -> Fernet:
    key = get_settings().token_encryption_key
    if not key:
        raise TokenCipherUnavailable(
            "TOKEN_ENCRYPTION_KEY is not set. Generate one with:\n"
            '  python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise TokenCipherUnavailable("TOKEN_ENCRYPTION_KEY is not a valid Fernet key") from exc


def encrypt_token(plaintext: str | None) -> str | None:
    """Encrypt a secret for storage. ``None`` passes through untouched."""
    if plaintext is None:
        return None
    return _cipher().encrypt(plaintext.encode()).decode()


def decrypt_token(stored: str | None) -> str | None:
    """Decrypt a stored secret.

    Rows written before encryption existed hold plaintext, which Fernet rejects.
    Those are returned as-is so existing users keep working; the value is
    re-encrypted the next time it is written.
    """
    if stored is None:
        return None
    try:
        return _cipher().decrypt(stored.encode()).decode()
    except InvalidToken:
        logger.warning("Found an unencrypted access token; it will be encrypted on next write.")
        return stored
