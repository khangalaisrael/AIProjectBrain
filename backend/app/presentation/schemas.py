"""Pydantic schemas for API request/response bodies."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.domain.enums import ImportStatus


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    github_id: int
    username: str
    email: str | None = None
    avatar_url: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class GitHubRepoOut(BaseModel):
    """A repository available on GitHub (not yet imported)."""

    github_id: int
    name: str
    full_name: str
    description: str | None = None
    language: str | None = None
    private: bool = False
    default_branch: str = "main"


class ImportRepositoryRequest(BaseModel):
    full_name: str


class RepositoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    github_id: int
    name: str
    full_name: str
    description: str | None = None
    language: str | None = None
    is_private: bool
    default_branch: str
    status: ImportStatus
    error_message: str | None = None
