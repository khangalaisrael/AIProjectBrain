"""Developer Thinking routes: infer and read engineering decisions."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.thinking_service import ThinkingService
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import DecisionOut

router = APIRouter(prefix="/repositories", tags=["thinking"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


@router.get("/{repository_id}/decisions", response_model=list[DecisionOut])
def list_decisions(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DecisionOut]:
    """Return the cached engineering decisions (empty until generated)."""
    _owned_repo(repository_id, current_user, db)
    decisions = ThinkingService(db).get(repository_id)
    return [DecisionOut.model_validate(item) for item in decisions]


@router.post("/{repository_id}/decisions", response_model=list[DecisionOut])
async def generate_decisions(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DecisionOut]:
    """Infer (or re-infer) the engineering decisions behind a repository."""
    repo = _owned_repo(repository_id, current_user, db)
    try:
        decisions = await ThinkingService(db).generate(repo, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [DecisionOut.model_validate(item) for item in decisions]
