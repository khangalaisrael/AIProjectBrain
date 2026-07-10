"""SQLAlchemy ORM models mapping domain concepts to relational tables."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import decrypt_token, encrypt_token
from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UserModel(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # The GitHub OAuth token is encrypted at rest; never read this column
    # directly, use the `access_token` property below.
    access_token_encrypted: Mapped[str | None] = mapped_column(String(512), nullable=True)

    repositories: Mapped[list[RepositoryModel]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def access_token(self) -> str | None:
        """The plaintext GitHub token, decrypted on access."""
        return decrypt_token(self.access_token_encrypted)

    @access_token.setter
    def access_token(self, value: str | None) -> None:
        self.access_token_encrypted = encrypt_token(value)


class RepositoryModel(TimestampMixin, Base):
    __tablename__ = "repositories"
    __table_args__ = (UniqueConstraint("user_id", "github_id", name="uq_repository_user_github"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    github_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main", nullable=False)
    clone_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    language: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_private: Mapped[bool] = mapped_column(default=False, nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        String(32), default=ImportStatus.PENDING, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    user: Mapped[UserModel] = relationship(back_populates="repositories")
    files: Mapped[list[FileModel]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )


class FileModel(TimestampMixin, Base):
    __tablename__ = "files"
    __table_args__ = (Index("ix_files_repository_path", "repository_id", "path"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    path: Mapped[str] = mapped_column(String(2048), nullable=False)
    language: Mapped[Language | None] = mapped_column(String(64), nullable=True)
    size_bytes: Mapped[int] = mapped_column(default=0, nullable=False)

    repository: Mapped[RepositoryModel] = relationship(back_populates="files")
    functions: Mapped[list[FunctionModel]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class FunctionModel(TimestampMixin, Base):
    __tablename__ = "functions"

    id: Mapped[int] = mapped_column(primary_key=True)
    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), index=True, nullable=False
    )
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    signature: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    start_line: Mapped[int] = mapped_column(nullable=False)
    end_line: Mapped[int] = mapped_column(nullable=False)

    file: Mapped[FileModel] = relationship(back_populates="functions")


class OverviewModel(TimestampMixin, Base):
    """Cached, LLM-generated project overview for a repository (one-to-one)."""

    __tablename__ = "overviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str | None] = mapped_column(String(32), nullable=True)
    learning_time_minutes: Mapped[int | None] = mapped_column(nullable=True)
    architecture_style: Mapped[str | None] = mapped_column(String(255), nullable=True)
    technologies: Mapped[list[str]] = mapped_column(JSON, default=list)
    features: Mapped[list[str]] = mapped_column(JSON, default=list)


class LessonModel(TimestampMixin, Base):
    """A single generated course lesson for a repository."""

    __tablename__ = "lessons"
    __table_args__ = (Index("ix_lessons_repository_order", "repository_id", "order_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    order_index: Mapped[int] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)


class DocumentModel(TimestampMixin, Base):
    """A generated documentation page for a repository (one per doc type)."""

    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("repository_id", "doc_type", name="uq_document_repo_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)


class GraphNodeModel(TimestampMixin, Base):
    """A node in the repository's knowledge graph (the Software Atlas)."""

    __tablename__ = "graph_nodes"
    __table_args__ = (
        UniqueConstraint("repository_id", "key", name="uq_graph_node_repo_key"),
        Index("ix_graph_nodes_repo_level", "repository_id", "level"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Stable, human-readable identity, e.g. "file:backend/app/main.py".
    key: Mapped[str] = mapped_column(String(1024), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    level: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    path: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    parent_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)


class GraphEdgeModel(TimestampMixin, Base):
    """A relationship between two graph nodes."""

    __tablename__ = "graph_edges"
    __table_args__ = (Index("ix_graph_edges_repo_source", "repository_id", "source_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    target_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)


class DecisionModel(TimestampMixin, Base):
    """An inferred engineering decision: what, why, trade-offs, alternatives."""

    __tablename__ = "decisions"
    __table_args__ = (Index("ix_decisions_repository_order", "repository_id", "order_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    order_index: Mapped[int] = mapped_column(nullable=False)
    decision: Mapped[str] = mapped_column(String(512), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    tradeoffs: Mapped[str] = mapped_column(Text, default="")
    alternatives: Mapped[str] = mapped_column(Text, default="")


class ChatMessageModel(TimestampMixin, Base):
    """One turn of a repository chat, kept so the thread survives a reload."""

    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_repo_user_id", "repository_id", "user_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    repository_id: Mapped[int] = mapped_column(
        ForeignKey("repositories.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Threads are per user as well as per repository: two people asking about the
    # same repo do not share a conversation.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Only assistant turns carry citations; a user turn stores an empty list.
    citations: Mapped[list] = mapped_column(JSON, default=list)
