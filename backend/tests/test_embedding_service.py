"""EmbeddingService tests with a fake embedder + in-memory vector store."""

from app.application.embedding_service import EmbeddingService
from app.domain.entities import CodeChunk


class FakeEmbedder:
    def embed(self, texts: list[str]) -> list[list[float]]:
        # Deterministic 3-dim vectors keyed on text length.
        return [[float(len(t)), 1.0, 0.0] for t in texts]


class FakeStore:
    def __init__(self) -> None:
        self.points: list[tuple[int, list[float], dict]] = []
        self.reset_calls: list[int] = []

    def upsert(self, points):
        self.points.extend(points)

    def delete_repository(self, repository_id: int):
        self.reset_calls.append(repository_id)


def _chunk(fid: int) -> CodeChunk:
    return CodeChunk(
        function_id=fid,
        repository_id=7,
        file_path="app/main.py",
        name=f"fn{fid}",
        start_line=1,
        end_line=5,
        code=f"def fn{fid}(): pass",
    )


def test_embed_and_store_builds_points_with_payload():
    store = FakeStore()
    service = EmbeddingService(embedder=FakeEmbedder(), store=store)

    stored = service.embed_and_store([_chunk(1), _chunk(2)])

    assert stored == 2
    assert len(store.points) == 2
    point_id, vector, payload = store.points[0]
    assert point_id == 1
    assert len(vector) == 3
    assert payload["repository_id"] == 7
    assert payload["file_path"] == "app/main.py"
    assert payload["code"].startswith("def fn1")


def test_embed_and_store_empty_is_noop():
    store = FakeStore()
    service = EmbeddingService(embedder=FakeEmbedder(), store=store)
    assert service.embed_and_store([]) == 0
    assert store.points == []


def test_reset_repository_delegates_to_store():
    store = FakeStore()
    EmbeddingService(embedder=FakeEmbedder(), store=store).reset_repository(7)
    assert store.reset_calls == [7]
