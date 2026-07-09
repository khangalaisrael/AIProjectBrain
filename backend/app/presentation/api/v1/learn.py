"""Learn routes: generate and read a repository's structured course."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.course_service import CourseService
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import LessonOut

router = APIRouter(prefix="/repositories", tags=["learn"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


@router.get("/{repository_id}/lessons", response_model=list[LessonOut])
def list_lessons(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LessonOut]:
    """Return the cached course lessons (empty until generated)."""
    _owned_repo(repository_id, current_user, db)
    lessons = CourseService(db).get(repository_id)
    return [LessonOut.model_validate(lesson) for lesson in lessons]


@router.post("/{repository_id}/lessons", response_model=list[LessonOut])
async def generate_lessons(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LessonOut]:
    """Generate (or regenerate) the course for a repository."""
    repo = _owned_repo(repository_id, current_user, db)
    try:
        lessons = await CourseService(db).generate(repo, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return [LessonOut.model_validate(lesson) for lesson in lessons]
