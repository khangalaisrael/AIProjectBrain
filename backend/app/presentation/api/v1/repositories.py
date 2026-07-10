"""Repository import and listing routes."""

from __future__ import annotations

import json
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.application.chat_service import ChatService
from app.application.repository_service import RepositoryService
from app.core.logging import get_logger
from app.infrastructure.db.models import ChatMessageModel, UserModel
from app.infrastructure.db.repositories import ChatMessageRepository, RepositoryRepository
from app.infrastructure.db.session import get_db
from app.presentation.dependencies import get_chat_service, get_current_user
from app.presentation.schemas import (
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    CitationOut,
    GitHubRepoOut,
    ImportRepositoryRequest,
    RepositoryOut,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/repositories", tags=["repositories"])


def _sse(payload: dict) -> str:
    """One server-sent event. The blank line is what ends the frame."""
    return f"data: {json.dumps(payload)}\n\n"


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


def _owned_repo(db: Session, repository_id: int, user: UserModel):
    """The repository, or 404 — a repository you don't own does not exist."""
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


def _citation_out(citation) -> CitationOut:
    return CitationOut(
        file_path=citation.file_path,
        name=citation.name,
        start_line=citation.start_line,
        end_line=citation.end_line,
    )


@router.post("/{repository_id}/chat", response_model=ChatResponse)
def chat_with_repository(
    repository_id: int,
    payload: ChatRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    chat: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    """Ask a question about an indexed repository (RAG over its code)."""
    _owned_repo(db, repository_id, current_user)

    messages = ChatMessageRepository(db)
    messages.append(repository_id, current_user.id, "user", payload.question)

    result = chat.answer(repository_id, payload.question)
    citations = [_citation_out(c) for c in result.citations]
    messages.append(
        repository_id,
        current_user.id,
        "assistant",
        result.answer,
        [c.model_dump() for c in citations],
    )
    return ChatResponse(answer=result.answer, citations=citations)


@router.post("/{repository_id}/chat/stream")
def stream_chat_with_repository(
    repository_id: int,
    payload: ChatRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
    chat: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    """The same answer as ``/chat``, streamed as server-sent events.

    Events are ``{"type": "token"|"citations"|"done"|"error"}``. The question is
    persisted before the first token so a dropped connection still leaves the
    thread coherent; the answer is persisted once the stream completes.
    """
    _owned_repo(db, repository_id, current_user)

    messages = ChatMessageRepository(db)
    messages.append(repository_id, current_user.id, "user", payload.question)

    def events() -> Iterator[str]:
        parts: list[str] = []
        citations: list[dict] = []
        try:
            for chunk in chat.answer_stream(repository_id, payload.question):
                if chunk.text is not None:
                    parts.append(chunk.text)
                    yield _sse({"type": "token", "text": chunk.text})
                elif chunk.citations is not None:
                    citations = [_citation_out(c).model_dump() for c in chunk.citations]
                    yield _sse({"type": "citations", "citations": citations})
        except Exception as exc:  # noqa: BLE001 - the stream must report, not 500
            logger.exception("Chat stream failed for repository %s", repository_id)
            # Whatever arrived before the failure is still worth keeping.
            if parts:
                messages.append(repository_id, current_user.id, "assistant", "".join(parts), [])
            yield _sse({"type": "error", "message": str(exc)})
            return

        stored = messages.append(
            repository_id, current_user.id, "assistant", "".join(parts), citations
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


@router.get("/{repository_id}/chat/messages", response_model=list[ChatMessageOut])
def list_chat_messages(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessageModel]:
    """This user's conversation about this repository, oldest first."""
    _owned_repo(db, repository_id, current_user)
    return ChatMessageRepository(db).list_for_thread(repository_id, current_user.id)


@router.delete("/{repository_id}/chat/messages", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat_messages(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Forget the conversation. Only this user's thread is touched."""
    _owned_repo(db, repository_id, current_user)
    ChatMessageRepository(db).clear_thread(repository_id, current_user.id)
