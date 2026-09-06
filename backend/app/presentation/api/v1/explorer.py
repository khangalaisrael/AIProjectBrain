"""Code Explorer routes: browse files/functions, explain a file, ask about a file."""

from __future__ import annotations

import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.application.explorer_service import ExplorerService
from app.core.logging import get_logger
from app.infrastructure.db.models import FileChatMessageModel, RepositoryModel, UserModel
from app.infrastructure.db.repositories import FileChatMessageRepository, RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import (
    ExplainResponse,
    FileChatMessageOut,
    FileDetailOut,
    FileQuestionRequest,
    FileTreeItem,
    FunctionOut,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/repositories", tags=["explorer"])


def _sse(payload: dict) -> str:
    """One server-sent event. The blank line is what ends the frame."""
    return f"data: {json.dumps(payload)}\n\n"


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


@router.get(
    "/{repository_id}/files/{file_id}/chat",
    response_model=list[FileChatMessageOut],
)
def list_file_chat(
    repository_id: int,
    file_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FileChatMessageModel]:
    """This user's conversation about this file, oldest first."""
    _owned_repo(repository_id, current_user, db)
    if ExplorerService(db).get_file(repository_id, file_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileChatMessageRepository(db).list_for_thread(repository_id, current_user.id, file_id)


@router.post("/{repository_id}/files/{file_id}/chat/stream")
async def stream_file_chat(
    repository_id: int,
    file_id: int,
    payload: FileQuestionRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Answer a question about one file, streamed as server-sent events.

    Events are ``{"type": "token"|"done"|"error"}``. The question is persisted
    before the first token so a dropped connection still leaves the thread
    coherent; the answer is persisted once the stream completes. The whole file
    is the model's context, plus the earlier turns of this file's thread.
    """
    repo = _owned_repo(repository_id, current_user, db)
    service = ExplorerService(db)
    file = service.get_file(repository_id, file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    messages = FileChatMessageRepository(db)
    history = messages.list_for_thread(repository_id, current_user.id, file_id)
    messages.append(repository_id, current_user.id, file_id, "user", payload.question)

    try:
        content = await service.file_content(repo, file, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    def events() -> Iterator[str]:
        parts: list[str] = []
        try:
            for delta in service.stream_file_answer(file, content, payload.question, history):
                parts.append(delta)
                yield _sse({"type": "token", "text": delta})
        except Exception as exc:  # noqa: BLE001 - the stream must report, not 500
            logger.exception("File chat stream failed for file %s", file_id)
            if parts:
                messages.append(
                    repository_id, current_user.id, file_id, "assistant", "".join(parts)
                )
            yield _sse({"type": "error", "message": str(exc)})
            return

        stored = messages.append(
            repository_id, current_user.id, file_id, "assistant", "".join(parts)
        )
        yield _sse({"type": "done", "message_id": stored.id})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Stop nginx buffering the stream into one lump.
            "X-Accel-Buffering": "no",
        },
    )


@router.delete(
    "/{repository_id}/files/{file_id}/chat",
    status_code=status.HTTP_204_NO_CONTENT,
)
def clear_file_chat(
    repository_id: int,
    file_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete this user's conversation about this file."""
    _owned_repo(repository_id, current_user, db)
    FileChatMessageRepository(db).clear_thread(repository_id, current_user.id, file_id)
