"""Pydantic schemas for API request/response bodies."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

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


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class CitationOut(BaseModel):
    file_path: str
    name: str
    start_line: int
    end_line: int


class ChatResponse(BaseModel):
    answer: str
    citations: list[CitationOut]


class FileTreeItem(BaseModel):
    id: int
    path: str
    language: str | None = None
    function_count: int


class FunctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    signature: str | None = None
    start_line: int
    end_line: int


class FileDetailOut(BaseModel):
    id: int
    path: str
    language: str | None = None
    content: str
    functions: list[FunctionOut]


class ExplainResponse(BaseModel):
    explanation: str


class FolderMapItem(BaseModel):
    folder: str
    file_count: int


class OverviewOut(BaseModel):
    summary: str
    difficulty: str | None = None
    learning_time_minutes: int | None = None
    architecture_style: str | None = None
    technologies: list[str]
    features: list[str]
    folder_map: list[FolderMapItem]


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    title: str
    content: str


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_index: int
    decision: str
    reason: str
    tradeoffs: str
    alternatives: str
