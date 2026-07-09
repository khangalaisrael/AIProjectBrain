"""Embedding use case: turn code chunks into vectors stored in Qdrant."""

from __future__ import annotations

from app.core.logging import get_logger
from app.domain.entities import CodeChunk
from app.infrastructure.embeddings.openai_embedder import OpenAIEmbedder
from app.infrastructure.vector.qdrant_store import QdrantVectorStore

logger = get_logger(__name__)


class EmbeddingService:
    """Embeds code chunks and upserts them into the vector store."""

    def __init__(
        self,
        embedder: OpenAIEmbedder | None = None,
        store: QdrantVectorStore | None = None,
    ) -> None:
        self._embedder = embedder or OpenAIEmbedder()
        self._store = store or QdrantVectorStore()

    def reset_repository(self, repository_id: int) -> None:
        """Drop any previously stored vectors for a repository."""
        self._store.delete_repository(repository_id)

    def embed_and_store(self, chunks: list[CodeChunk]) -> int:
        """Embed chunks and upsert them; returns the number stored."""
        if not chunks:
            return 0

        texts = [_chunk_to_text(chunk) for chunk in chunks]
        vectors = self._embedder.embed(texts)

        points = [
            (
                chunk.function_id,
                vector,
                {
                    "repository_id": chunk.repository_id,
                    "function_id": chunk.function_id,
                    "file_path": chunk.file_path,
                    "name": chunk.name,
                    "start_line": chunk.start_line,
                    "end_line": chunk.end_line,
                    "code": chunk.code,
                },
            )
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]
        self._store.upsert(points)
        logger.info("Stored %d embeddings", len(points))
        return len(points)


def _chunk_to_text(chunk: CodeChunk) -> str:
    """Compose the text that represents a chunk for embedding."""
    return f"File: {chunk.file_path}\nFunction: {chunk.name}\n\n{chunk.code}"
