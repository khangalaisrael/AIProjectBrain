"""Project Overview routes: generate and read a cached LLM summary."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.overview_service import OverviewService
from app.infrastructure.db.models import OverviewModel, RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import FolderMapItem, OverviewOut

router = APIRouter(prefix="/repositories", tags=["overview"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _to_out(overview: OverviewModel, service: OverviewService, repository_id: int) -> OverviewOut:
    return OverviewOut(
        summary=overview.summary,
        difficulty=overview.difficulty,
        learning_time_minutes=overview.learning_time_minutes,
        architecture_style=overview.architecture_style,
        technologies=overview.technologies or [],
        features=overview.features or [],
        folder_map=[FolderMapItem(**item) for item in service.folder_map(repository_id)],
    )


@router.get("/{repository_id}/overview", response_model=OverviewOut)
def get_overview(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OverviewOut:
    """Return the cached overview, or 404 if it has not been generated yet."""
    _owned_repo(repository_id, current_user, db)
    service = OverviewService(db)
    overview = service.get(repository_id)
    if overview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Overview not generated")
    return _to_out(overview, service, repository_id)


@router.post("/{repository_id}/overview", response_model=OverviewOut)
async def generate_overview(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OverviewOut:
    """Generate (or regenerate) the project overview with the LLM."""
    repo = _owned_repo(repository_id, current_user, db)
    service = OverviewService(db)
    try:
        overview = await service.generate(repo, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return _to_out(overview, service, repository_id)
