"""Qdrant vector store for code-chunk embeddings.

Encapsulates collection management, upserts, repository-scoped search, and
deletion so the application layer works with simple dicts.
"""

from __future__ import annotations

from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import get_settings

# Collections already given their payload index in this process. Qdrant Cloud
# rejects filters on unindexed fields, and creating the index is idempotent, so
# one call per process covers collections that predate it.
_indexed: set[str] = set()

# Points per upsert request. A 1536-dim vector is ~30 KB as JSON, so this keeps
# each request around 5 MB, well under Qdrant Cloud's 32 MB body limit.
_UPSERT_BATCH = 128


@dataclass(slots=True)
class SearchHit:
    score: float
    payload: dict


class QdrantVectorStore:
    def __init__(self, client: QdrantClient | None = None) -> None:
        settings = get_settings()
        self._collection = settings.qdrant_collection
        self._dim = settings.embedding_dim
        self._client = client or QdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key or None
        )

    def ensure_collection(self) -> None:
        """Create the collection if it does not already exist."""
        existing = {c.name for c in self._client.get_collections().collections}
        if self._collection not in existing:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
            )
        if self._collection not in _indexed:
            self._client.create_payload_index(
                collection_name=self._collection,
                field_name="repository_id",
                field_schema=PayloadSchemaType.INTEGER,
            )
            _indexed.add(self._collection)

    def upsert(self, points: list[tuple[int, list[float], dict]]) -> None:
        """Upsert (id, vector, payload) tuples."""
        if not points:
            return
        self.ensure_collection()
        for start in range(0, len(points), _UPSERT_BATCH):
            self._client.upsert(
                collection_name=self._collection,
                points=[
                    PointStruct(id=point_id, vector=vector, payload=payload)
                    for point_id, vector, payload in points[start : start + _UPSERT_BATCH]
                ],
            )

    def search(self, vector: list[float], repository_id: int, limit: int) -> list[SearchHit]:
        """Nearest chunks within a single repository."""
        self.ensure_collection()
        result = self._client.query_points(
            collection_name=self._collection,
            query=vector,
            limit=limit,
            query_filter=_repository_filter(repository_id),
            with_payload=True,
        )
        return [SearchHit(score=p.score, payload=p.payload or {}) for p in result.points]

    def delete_repository(self, repository_id: int) -> None:
        """Remove all vectors belonging to a repository (used before re-indexing)."""
        self.ensure_collection()
        self._client.delete(
            collection_name=self._collection,
            points_selector=_repository_filter(repository_id),
        )


def _repository_filter(repository_id: int) -> Filter:
    return Filter(must=[FieldCondition(key="repository_id", match=MatchValue(value=repository_id))])
