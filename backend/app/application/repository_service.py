"""Repository import use cases."""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.infrastructure.db.models import RepositoryModel, UserModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.github.client import GitHubClient


class RepositoryService:
    """Lists GitHub repositories and imports them for indexing."""

    def __init__(
        self,
        session: Session,
        github: GitHubClient | None = None,
        enqueue_index: Callable[[int], None] | None = None,
    ) -> None:
        self._session = session
        self._repos = RepositoryRepository(session)
        self._github = github or GitHubClient()
        # Indirection so the indexing task can be stubbed in tests.
        self._enqueue_index = enqueue_index or _default_enqueue_index

    async def list_github_repositories(self, user: UserModel) -> list[dict]:
        """Repositories the user owns on GitHub, as raw payloads."""
        if not user.access_token:
            return []
        return await self._github.list_repositories(user.access_token)

    async def search_github_repositories(self, user: UserModel, query: str) -> list[dict]:
        """Search public repositories on GitHub (any owner)."""
        return await self._github.search_repositories(user.access_token or "", query)

    def list_imported(self, user: UserModel) -> list[RepositoryModel]:
        return self._repos.list_for_user(user.id)

    async def import_repository(self, user: UserModel, full_name: str) -> RepositoryModel:
        """Import a repository by ``owner/name`` and queue it for indexing.

        Idempotent: re-importing an existing repo returns the existing record.
        """
        repo = await self._github.get_repository(user.access_token or "", full_name)

        existing = self._repos.get_for_user_by_github_id(user.id, repo["id"])
        if existing is not None:
            return existing

        model = self._repos.create_from_github(user.id, repo)
        self._enqueue_index(model.id)
        return model


def _default_enqueue_index(repository_id: int) -> None:
    """Queue the indexing Celery task (imported lazily to avoid cycles)."""
    from app.infrastructure.tasks import index_repository

    index_repository.delay(repository_id)
