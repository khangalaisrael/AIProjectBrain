"""Qdrant store setup: managed Qdrant needs a payload index to filter on."""

from __future__ import annotations

from types import SimpleNamespace

from app.infrastructure.vector import qdrant_store
from app.infrastructure.vector.qdrant_store import QdrantVectorStore


class FakeClient:
    def __init__(self, existing: list[str]) -> None:
        self.existing = existing
        self.indexes: list[tuple[str, str]] = []
        self.upserts: list[int] = []

    def get_collections(self):
        return SimpleNamespace(collections=[SimpleNamespace(name=n) for n in self.existing])

    def create_collection(self, collection_name, vectors_config) -> None:
        self.existing.append(collection_name)

    def create_payload_index(self, collection_name, field_name, field_schema) -> None:
        self.indexes.append((collection_name, field_name))

    def upsert(self, collection_name, points) -> None:
        self.upserts.append(len(points))


def test_existing_collection_gets_repository_index_once(monkeypatch) -> None:
    monkeypatch.setattr(qdrant_store, "_indexed", set())
    client = FakeClient(existing=["code_chunks"])
    store = QdrantVectorStore(client=client)

    store.ensure_collection()
    store.ensure_collection()

    assert client.indexes == [("code_chunks", "repository_id")]


def test_upsert_is_split_into_batches(monkeypatch) -> None:
    monkeypatch.setattr(qdrant_store, "_UPSERT_BATCH", 2)
    client = FakeClient(existing=["code_chunks"])
    QdrantVectorStore(client=client).upsert([(i, [0.0], {}) for i in range(5)])
    assert client.upserts == [2, 2, 1]
