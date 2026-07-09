"""Repository indexing use case: clone → parse → persist.

The heavy, network-bound clone step is isolated from the pure filesystem walk
(`index_directory`) so the parsing logic can be tested without any network or
git access.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from git import Repo as GitRepo
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel
from app.infrastructure.db.repositories import RepositoryRepository
from app.infrastructure.parsing.tree_sitter_parser import parse_functions

logger = get_logger(__name__)

# Directories never worth indexing.
_IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
}
# Skip files larger than this (bytes) to keep parsing bounded.
_MAX_FILE_BYTES = 1_000_000


class IndexingService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._repos = RepositoryRepository(session)

    def run(self, repository_id: int, access_token: str | None = None) -> None:
        """Full pipeline for a repository: clone, parse, persist, mark ready."""
        repo = self._repos.get_by_id(repository_id)
        if repo is None:
            logger.warning("Indexing requested for unknown repository %s", repository_id)
            return

        try:
            self._repos.set_status(repo.id, ImportStatus.CLONING)
            with tempfile.TemporaryDirectory(prefix="brain-clone-") as tmp:
                self._clone(repo, Path(tmp), access_token)
                self._repos.set_status(repo.id, ImportStatus.PARSING)
                self.index_directory(repo, Path(tmp))
            self._repos.set_status(repo.id, ImportStatus.READY)
        except Exception as exc:  # noqa: BLE001 - record failure, don't crash the worker
            logger.exception("Indexing failed for repository %s", repository_id)
            self._repos.set_status(repo.id, ImportStatus.FAILED, error_message=str(exc)[:2000])

    def index_directory(self, repo: RepositoryModel, root: Path) -> int:
        """Walk ``root``, parse supported files, and persist files + functions.

        Returns the number of files indexed. Pure filesystem work — no network.
        """
        indexed = 0
        for path in _iter_source_files(root):
            language = Language.from_path(str(path))
            if language is None:
                continue

            try:
                size = path.stat().st_size
                if size > _MAX_FILE_BYTES:
                    continue
                source = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            file_model = FileModel(
                repository_id=repo.id,
                path=str(path.relative_to(root)).replace("\\", "/"),
                language=language,
                size_bytes=size,
            )
            self._session.add(file_model)
            self._session.flush()  # assign file_model.id

            for func in parse_functions(source, language):
                self._session.add(
                    FunctionModel(
                        file_id=file_model.id,
                        repository_id=repo.id,
                        name=func.name,
                        signature=func.signature,
                        start_line=func.start_line,
                        end_line=func.end_line,
                    )
                )
            indexed += 1

        self._session.commit()
        return indexed

    @staticmethod
    def _clone(repo: RepositoryModel, dest: Path, access_token: str | None) -> None:
        """Clone ``repo`` into ``dest`` (shallow), embedding a token for private repos."""
        clone_url = repo.clone_url
        if access_token:
            parsed = urlparse(repo.clone_url)
            netloc = f"x-access-token:{access_token}@{parsed.netloc}"
            clone_url = urlunparse(parsed._replace(netloc=netloc))
        GitRepo.clone_from(clone_url, dest, depth=1, branch=repo.default_branch)


def _iter_source_files(root: Path):
    """Yield files under ``root``, skipping ignored directories."""
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in _IGNORED_DIRS for part in path.parts):
            continue
        yield path
