"""Repository import and listing routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.application.repository_service import RepositoryService
from app.infrastructure.db.models import UserModel
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import (
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


@router.get("/github", response_model=list[GitHubRepoOut])
async def list_github_repositories(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GitHubRepoOut]:
    """List the user's repositories available on GitHub (not yet imported)."""
    repos = await RepositoryService(db).list_github_repositories(current_user)
    return [
        GitHubRepoOut(
            github_id=repo["id"],
            name=repo["name"],
            full_name=repo["full_name"],
            description=repo.get("description"),
            language=repo.get("language"),
            private=bool(repo.get("private", False)),
            default_branch=repo.get("default_branch") or "main",
        )
        for repo in repos
    ]


@router.post("", response_model=RepositoryOut, status_code=status.HTTP_201_CREATED)
async def import_repository(
    payload: ImportRepositoryRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserModel:
    """Import a repository by ``owner/name`` and queue it for indexing."""
    return await RepositoryService(db).import_repository(current_user, payload.full_name)
