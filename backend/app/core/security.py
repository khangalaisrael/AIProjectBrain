"""JWT helpers for issuing and validating session tokens."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings


class TokenError(Exception):
    """Raised when a token is missing, malformed, or expired."""


def create_access_token(subject: str) -> str:
    """Issue a signed JWT whose subject is the user id."""
    settings = get_settings()
    now = datetime.now(tz=UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Return the subject (user id) from a valid token, or raise ``TokenError``."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:  # noqa: BLE001 - normalize to a domain error
        raise TokenError(str(exc)) from exc

    subject = payload.get("sub")
    if not subject:
        raise TokenError("Token is missing a subject")
    return subject
