"""Celery tasks for background processing."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.infrastructure.celery_app import celery_app
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.db.session import SessionLocal

logger = get_logger(__name__)


@celery_app.task(name="index_repository")
def index_repository(repository_id: int) -> None:
    """Clone, parse, and embed a repository. Runs off the request path."""
    # Imported here to keep the Celery module import graph light.
    from app.application.embedding_service import EmbeddingService
    from app.application.indexing_service import IndexingService

    # Only embed when an OpenAI key is configured; otherwise index code only.
    embedder = EmbeddingService() if get_settings().openai_api_key else None

    session = SessionLocal()
    try:
        repo = RepositoryRepository(session).get_by_id(repository_id)
        access_token = repo.user.access_token if repo and repo.user else None
        IndexingService(session, embedder=embedder).run(repository_id, access_token=access_token)
    finally:
        session.close()
