"""GitHub access tokens must never sit in the database in plaintext."""

import pytest
from sqlalchemy import text

from app.core.crypto import decrypt_token, encrypt_token
from app.infrastructure.db.models import UserModel
from app.infrastructure.db.repositories import UserRepository

PLAINTEXT = "gho_supersecrettoken"


def test_encrypt_decrypt_roundtrip():
    ciphertext = encrypt_token(PLAINTEXT)
    assert ciphertext != PLAINTEXT
    assert decrypt_token(ciphertext) == PLAINTEXT


def test_encryption_is_non_deterministic():
    """Fernet embeds a timestamp + IV, so the same token encrypts differently."""
    assert encrypt_token(PLAINTEXT) != encrypt_token(PLAINTEXT)


@pytest.mark.parametrize("value", [None])
def test_none_passes_through(value):
    assert encrypt_token(value) is None
    assert decrypt_token(value) is None


def test_column_holds_ciphertext_not_the_token(db_session):
    """The property is transparent, but the raw column must be unreadable."""
    user = UserModel(github_id=555, username="octocat")
    user.access_token = PLAINTEXT
    db_session.add(user)
    db_session.commit()

    # Read the raw column, bypassing the ORM property entirely.
    raw = db_session.execute(
        text("SELECT access_token_encrypted FROM users WHERE id = :id"), {"id": user.id}
    ).scalar_one()

    assert raw != PLAINTEXT
    assert PLAINTEXT not in raw
    # ...yet the application sees the real token.
    assert user.access_token == PLAINTEXT


def test_legacy_plaintext_row_is_still_readable(db_session):
    """Rows written before encryption existed must not break existing users."""
    user = UserModel(github_id=556, username="octocat")
    db_session.add(user)
    db_session.commit()

    db_session.execute(
        text("UPDATE users SET access_token_encrypted = :v WHERE id = :id"),
        {"v": PLAINTEXT, "id": user.id},
    )
    db_session.commit()
    db_session.expire_all()

    reloaded = db_session.get(UserModel, user.id)
    assert reloaded.access_token == PLAINTEXT


def test_upsert_from_github_stores_an_encrypted_token(db_session):
    profile = {"id": 777, "login": "octocat", "email": None, "avatar_url": None}
    user = UserRepository(db_session).upsert_from_github(profile, PLAINTEXT)

    raw = db_session.execute(
        text("SELECT access_token_encrypted FROM users WHERE id = :id"), {"id": user.id}
    ).scalar_one()
    assert raw != PLAINTEXT
    assert user.access_token == PLAINTEXT
