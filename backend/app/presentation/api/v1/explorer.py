"""Code Explorer routes: browse files/functions and explain a file."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.explorer_service import ExplorerService
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import (
    ExplainResponse,
    FileDetailOut,
    FileTreeItem,
    FunctionOut,
)

router = APIRouter(prefix="/repositories", tags=["explorer"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


@router.get("/{repository_id}/files", response_model=list[FileTreeItem])
def list_files(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FileTreeItem]:
    """List the indexed files of a repository with their function counts."""
    _owned_repo(repository_id, current_user, db)
    files = ExplorerService(db).list_files(repository_id)
    return [
        FileTreeItem(
            id=file.id,
            path=file.path,
            language=file.language,
            function_count=count,
        )
        for file, count in files
    ]


@router.get("/{repository_id}/files/{file_id}", response_model=FileDetailOut)
async def get_file(
    repository_id: int,
    file_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileDetailOut:
    """Return a file's source content plus its indexed functions."""
    repo = _owned_repo(repository_id, current_user, db)
    service = ExplorerService(db)
    file = service.get_file(repository_id, file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        detail = await service.file_detail(repo, file, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return FileDetailOut(
        id=file.id,
        path=file.path,
        language=file.language,
        content=detail.content,
        functions=[FunctionOut.model_validate(fn) for fn in detail.functions],
    )


@router.post("/{repository_id}/files/{file_id}/explain", response_model=ExplainResponse)
async def explain_file(
    repository_id: int,
    file_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExplainResponse:
    """Generate an AI explanation of a file."""
    repo = _owned_repo(repository_id, current_user, db)
    service = ExplorerService(db)
    file = service.get_file(repository_id, file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        explanation = await service.explain_file(repo, file, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return ExplainResponse(explanation=explanation)
