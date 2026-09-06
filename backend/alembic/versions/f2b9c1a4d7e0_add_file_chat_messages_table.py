"""add file_chat_messages table

Revision ID: f2b9c1a4d7e0
Revises: a1c4f7b2d903
Create Date: 2026-09-06 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f2b9c1a4d7e0"
down_revision: str | None = "a1c4f7b2d903"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "file_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("repository_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["repository_id"], ["repositories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_file_chat_messages_repository_id"),
        "file_chat_messages",
        ["repository_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_file_chat_messages_user_id"), "file_chat_messages", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_file_chat_messages_file_id"), "file_chat_messages", ["file_id"], unique=False
    )
    op.create_index(
        "ix_file_chat_messages_thread",
        "file_chat_messages",
        ["repository_id", "user_id", "file_id", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_file_chat_messages_thread", table_name="file_chat_messages")
    op.drop_index(op.f("ix_file_chat_messages_file_id"), table_name="file_chat_messages")
    op.drop_index(op.f("ix_file_chat_messages_user_id"), table_name="file_chat_messages")
    op.drop_index(op.f("ix_file_chat_messages_repository_id"), table_name="file_chat_messages")
    op.drop_table("file_chat_messages")
