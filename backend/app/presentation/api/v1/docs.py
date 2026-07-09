"""Documentation routes: generate and read per-type project docs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.application.docs_service import DocsService
from app.domain.enums import DocType
from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import get_db
from app.infrastructure.github.client import GitHubError
from app.presentation.dependencies import get_current_user
from app.presentation.schemas import DocumentOut

router = APIRouter(prefix="/repositories", tags=["documentation"])


def _owned_repo(repository_id: int, user: UserModel, db: Session) -> RepositoryModel:
    repo = RepositoryRepository(db).get_by_id(repository_id)
    if repo is None or repo.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


@router.get("/{repository_id}/docs", response_model=list[DocumentOut])
def list_documents(
    repository_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    """Return the documents generated so far (empty until generated)."""
    _owned_repo(repository_id, current_user, db)
    documents = DocsService(db).list(repository_id)
    return [DocumentOut.model_validate(doc) for doc in documents]


@router.post("/{repository_id}/docs/{doc_type}", response_model=DocumentOut)
async def generate_document(
    repository_id: int,
    doc_type: DocType,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentOut:
    """Generate (or regenerate) one documentation page."""
    repo = _owned_repo(repository_id, current_user, db)
    try:
        document = await DocsService(db).generate(repo, doc_type, current_user.access_token)
    except GitHubError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return DocumentOut.model_validate(document)
