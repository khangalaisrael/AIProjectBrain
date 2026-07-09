"""Repository import and listing routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.application.chat_service import ChatService
from app.application.repository_service import RepositoryService
from app.infrastructure.db.models import UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import (
    ChatRequest,
    ChatResponse,
    CitationOut,
    GitHubRepoOut,
    ImportRepositoryRequest,
    RepositoryOut,
)

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("", response_model=list[RepositoryOut])
def list_repositories(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserModel]:
    """List repositories the user has already imported."""
    return RepositoryService(db).list_imported(current_user)


def _to_github_repo_out(repo: dict) -> GitHubRepoOut:
    return GitHubRepoOut(
        github_id=repo["id"],
        name=repo["name"],
        full_name=repo["full_name"],
        description=repo.get("description"),
        language=repo.get("language"),
        private=bool(repo.get("private", False)),
        default_branch=repo.get("default_branch") or "main",
        stars=int(repo.get("stargazers_count") or 0),
    )


@router.get("/github", response_model=list[GitHubRepoOut])
async def list_github_repositories(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GitHubRepoOut]:
    """List the user's repositories available on GitHub (not yet imported)."""
    repos = await RepositoryService(db).list_github_repositories(current_user)
    return [_to_github_repo_out(repo) for repo in repos]


@router.get("/search", response_model=list[GitHubRepoOut])
async def search_github_repositories(
    q: str = Query(min_length=1, max_length=256, description="GitHub search query"),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GitHubRepoOut]:
    """Search public repositories on GitHub so any of them can be imported."""
    repos = await RepositoryService(db).search_github_repositories(current_user, q)
    return [_to_github_repo_out(repo) for repo in repos]


@router.post("", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED)
async def import_repository(
    payload: ImportRepositoryRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserModel:
    """Import a repository by ``owner/name`` and queue it for indexing."""
    return await RepositoryService(db).import_repository(current_user, payload.full_name)


@router.post("/{repository_id}/chat", response_model=ChatResponse)
def chat_with_repository(
    repository_id: int,
    payload: ChatRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Ask a question about an indexed repository (RAG over its code)."""
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    result = ChatService().answer(repository_id, payload.question)
    return ChatResponse(
        answer=result.answer,
        citations=[
            CitationOut(
                file_path=c.file_path,
                name=c.name,
                start_line=c.start_line,
                end_line=c.end_line,
            )
            for c in result.citations
        ],
    )
