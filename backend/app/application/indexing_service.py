"""Repository indexing use case: clone → parse → persist.

The heavy, network-bound clone step is isolated from the pure filesystem walk
(`index_directory`) so the parsing logic can be tested without any network or
git access.
"""

from __future__ import annotations

import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from git import Repo as GitRepo
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.application.embedding_service import EmbeddingService
from app.application.graph_builder import GraphBuilder
from app.core.logging import get_logger
from app.domain.entities import CodeChunk
from app.domain.enums import ImportStatus, Language
from app.infrastructure.db.models import FileModel, FunctionModel, RepositoryModel
from app.infrastructure.db.repositories import GraphRepository, RepositoryRepository
from app.infrastructure.parsing.tree_sitter_parser import ParsedFile, parse_file


@dataclass
class IndexResult:
    """Everything a single indexing pass produced."""

    chunks: list[CodeChunk] = field(default_factory=list)
    parsed_by_path: dict[str, ParsedFile] = field(default_factory=dict)
    file_ids: dict[str, int] = field(default_factory=dict)


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
# Cap the code text sent to the embedding model (chars) to stay under token limits.
_MAX_CHUNK_CHARS = 8_000


class IndexingService:
    def __init__(self, session: Session, embedder: EmbeddingService | None = None) -> None:
        self._session = session
        self._repos = RepositoryRepository(session)
        # When None, embeddings are skipped (used by offline tests).
        self._embedder = embedder

    def run(self, repository_id: int, access_token: str | None = None) -> None:
        """Full pipeline: clone → parse/persist → embed → mark ready."""
        repo = self._repos.get_by_id(repository_id)
        if repo is None:
            logger.warning("Indexing requested for unknown repository %s", repository_id)
            return

        try:
            self._repos.set_status(repo.id, ImportStatus.CLONING)
            with tempfile.TemporaryDirectory(prefix="brain-clone-") as tmp:
                self._clone(repo, Path(tmp), access_token)
                self._repos.set_status(repo.id, ImportStatus.PARSING)
                self._clear_previous_index(repo.id)
                result = self.index_directory(repo, Path(tmp))
                self._build_graph(repo, result)

            if self._embedder is not None and result.chunks:
                self._repos.set_status(repo.id, ImportStatus.INDEXING)
                self._embedder.reset_repository(repo.id)
                self._embedder.embed_and_store(result.chunks)

            self._repos.set_status(repo.id, ImportStatus.READY)
        except Exception as exc:  # noqa: BLE001 - record failure, don't crash the worker
            logger.exception("Indexing failed for repository %s", repository_id)
            self._repos.set_status(repo.id, ImportStatus.FAILED, error_message=str(exc)[:2000])

    def index_directory(self, repo: RepositoryModel, root: Path) -> IndexResult:
        """Walk ``root``, parse supported files, persist files + functions.

        Returns the embeddable chunks plus the static-analysis output needed to
        build the knowledge graph. Pure filesystem work — no network.
        """
        result = IndexResult()
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

            rel_path = str(path.relative_to(root)).replace("\\", "/")
            file_model = FileModel(
                repository_id=repo.id,
                path=rel_path,
                language=language,
                size_bytes=size,
            )
            self._session.add(file_model)
            self._session.flush()  # assign file_model.id

            # Single parse pass feeds both embeddings and the graph.
            parsed = parse_file(source, language)
            result.parsed_by_path[rel_path] = parsed
            result.file_ids[rel_path] = file_model.id

            lines = source.splitlines()
            pending: list[tuple[FunctionModel, str]] = []
            for func in parsed.functions:
                model = FunctionModel(
                    file_id=file_model.id,
                    repository_id=repo.id,
                    name=func.name,
                    signature=func.signature,
                    start_line=func.start_line,
                    end_line=func.end_line,
                )
                self._session.add(model)
                code = "\n".join(lines[func.start_line - 1 : func.end_line])[:_MAX_CHUNK_CHARS]
                pending.append((model, code))

            self._session.flush()  # assign function ids
            for model, code in pending:
                result.chunks.append(
                    CodeChunk(
                        function_id=model.id,
                        repository_id=repo.id,
                        file_path=rel_path,
                        name=model.name,
                        start_line=model.start_line,
                        end_line=model.end_line,
                        code=code,
                    )
                )

        self._session.commit()
        return result

    def _build_graph(self, repo: RepositoryModel, result: IndexResult) -> None:
        """Build and persist the knowledge graph for the Software Atlas."""
        nodes, edges = GraphBuilder(repo.full_name, result.file_ids).build(result.parsed_by_path)
        GraphRepository(self._session).replace(repo.id, nodes, edges)
        logger.info(
            "Graph built for %s: %d nodes, %d edges", repo.full_name, len(nodes), len(edges)
        )

    def _clear_previous_index(self, repository_id: int) -> None:
        """Remove prior files/functions/graph so re-indexing starts clean."""
        self._session.execute(
            delete(FunctionModel).where(FunctionModel.repository_id == repository_id)
        )
        self._session.execute(delete(FileModel).where(FileModel.repository_id == repository_id))
        GraphRepository(self._session).clear(repository_id)
        self._session.commit()

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
