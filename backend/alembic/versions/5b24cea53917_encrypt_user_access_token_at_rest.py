"""encrypt user access token at rest

Renames ``users.access_token`` to ``users.access_token_encrypted``, widens it to
hold ciphertext, and encrypts any rows that were written in plaintext.

Revision ID: 5b24cea53917
Revises: 2aac0fa0f3fb
Create Date: 2026-07-10 04:50:47.916074
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "5b24cea53917"
down_revision: str | None = "2aac0fa0f3fb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_users = sa.table(
    "users",
    sa.column("id", sa.Integer),
    sa.column("access_token_encrypted", sa.String),
)


def upgrade() -> None:
    # SQLite cannot ALTER a column in place; batch mode rebuilds the table.
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "access_token",
            new_column_name="access_token_encrypted",
            existing_type=sa.String(length=255),
            type_=sa.String(length=512),
            existing_nullable=True,
        )

    _transform(encrypt=True)


def downgrade() -> None:
    _transform(encrypt=False)

    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "access_token_encrypted",
            new_column_name="access_token",
            existing_type=sa.String(length=512),
            type_=sa.String(length=255),
            existing_nullable=True,
        )


def _transform(*, encrypt: bool) -> None:
    """Encrypt (or decrypt) the stored tokens in place.

    Skipped when no key is configured — the application falls back to reading
    legacy plaintext and re-encrypts on the next write.
    """
    from app.core.crypto import TokenCipherUnavailable, decrypt_token, encrypt_token

    connection = op.get_bind()
    rows = connection.execute(
        sa.select(_users.c.id, _users.c.access_token_encrypted).where(
            _users.c.access_token_encrypted.isnot(None)
        )
    ).all()

    for user_id, value in rows:
        try:
            # decrypt_token passes plaintext straight through, so encrypting its
            # result is safe whether or not the row was already encrypted.
            new_value = encrypt_token(decrypt_token(value)) if encrypt else decrypt_token(value)
        except TokenCipherUnavailable:
            print("TOKEN_ENCRYPTION_KEY not set; leaving access tokens untouched.")
            return

        connection.execute(
            _users.update().where(_users.c.id == user_id).values(access_token_encrypted=new_value)
        )
