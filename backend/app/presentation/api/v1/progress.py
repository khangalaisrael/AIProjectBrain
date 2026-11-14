"""Learning progress: which lessons a user has completed, kept per account."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.db.models import (
    LessonModel,
    LessonProgressModel,
    RepositoryModel,
    UserModel,
)
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_current_user

router = APIRouter(prefix="/progress", tags=["progress"])


class ProgressOut(BaseModel):
    """Completed lesson ids keyed by repository id (as a string, for JSON)."""

    completed: dict[str, list[int]]


class ProgressIn(BaseModel):
    done: bool


@router.get("", response_model=ProgressOut)
def get_progress(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressOut:
    rows = db.execute(
        select(LessonModel.repository_id, LessonModel.id)
        .join(LessonProgressModel, LessonProgressModel.lesson_id == LessonModel.id)
        .where(LessonProgressModel.user_id == current_user.id)
        .order_by(LessonModel.repository_id, LessonModel.order_index)
    ).all()
    completed: dict[str, list[int]] = {}
    for repository_id, lesson_id in rows:
        completed.setdefault(str(repository_id), []).append(lesson_id)
    return ProgressOut(completed=completed)


@router.put("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def set_lesson_progress(
    lesson_id: int,
    body: ProgressIn,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Mark a lesson done or not done. Only lessons of the user's own repositories count."""
    lesson = db.execute(
        select(LessonModel)
        .join(RepositoryModel, RepositoryModel.id == LessonModel.repository_id)
        .where(LessonModel.id == lesson_id, RepositoryModel.user_id == current_user.id)
    ).scalar_one_or_none()
    if lesson is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    existing = db.execute(
        select(LessonProgressModel).where(
            LessonProgressModel.user_id == current_user.id,
            LessonProgressModel.lesson_id == lesson_id,
        )
    ).scalar_one_or_none()
    if body.done and existing is None:
        db.add(LessonProgressModel(user_id=current_user.id, lesson_id=lesson_id))
        db.commit()
    elif not body.done and existing is not None:
        db.delete(existing)
        db.commit()
