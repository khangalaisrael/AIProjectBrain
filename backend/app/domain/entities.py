"""Domain entities.

Framework-free representations of the core concepts. The ORM models in the
infrastructure layer map to these; services speak in terms of these entities.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.enums import ImportStatus, Language


@dataclass(slots=True)
class User:
    id: int | None
    github_id: int
    username: str
    email: str | None = None
    avatar_url: str | None = None


@dataclass(slots=True)
class Repository:
    id: int | None
    user_id: int
    github_id: int
    name: str
    full_name: str
    clone_url: str
    default_branch: str = "main"
    description: str | None = None
    language: str | None = None
    is_private: bool = False
    status: ImportStatus = ImportStatus.PENDING
    error_message: str | None = None


@dataclass(slots=True)
class SourceFile:
    id: int | None
    repository_id: int
    path: str
    language: Language | None
    size_bytes: int


@dataclass(slots=True)
class CodeFunction:
    id: int | None
    file_id: int
    repository_id: int
    name: str
    start_line: int
    end_line: int
    signature: str | None = None
