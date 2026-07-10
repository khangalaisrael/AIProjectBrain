"""ChatService (RAG) tests with fake embedder / store / chat clients."""

from app.application.chat_service import ChatService
from app.infrastructure.vector.qdrant_store import SearchHit


class FakeEmbedder:
    def embed_one(self, text: str) -> list[float]:
        return [0.1, 0.2, 0.3]


class FakeStore:
    def __init__(self, hits: list[SearchHit]) -> None:
        self._hits = hits
        self.searched: tuple[int, int] | None = None

    def search(self, vector, repository_id: int, limit: int) -> list[SearchHit]:
        self.searched = (repository_id, limit)
        return self._hits


class FakeChat:
    def __init__(self) -> None:
        self.last_user_prompt: str | None = None

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        self.last_user_prompt = user_prompt
        return "The handler validates the request."


def _hit(fid: int, path: str) -> SearchHit:
    return SearchHit(
        score=0.9,
        payload={
            "function_id": fid,
            "file_path": path,
            "name": "handle",
            "start_line": 1,
            "end_line": 10,
            "code": "def handle(): ...",
        },
    )


def test_answer_uses_retrieved_context_and_returns_citations():
    store = FakeStore([_hit(1, "app/api.py"), _hit(2, "app/service.py")])
    chat = FakeChat()
    service = ChatService(embedder=FakeEmbedder(), store=store, chat=chat)

    result = service.answer(repository_id=42, question="What does the handler do?")

    assert result.answer == "The handler validates the request."
    assert [c.file_path for c in result.citations] == ["app/api.py", "app/service.py"]
    # Retrieved code was placed into the prompt, scoped to the repository.
    assert "def handle" in chat.last_user_prompt
    assert store.searched == (42, 6)  # default rag_top_k


def test_answer_with_no_hits_returns_guidance_and_no_llm_call():
    chat = FakeChat()
    service = ChatService(embedder=FakeEmbedder(), store=FakeStore([]), chat=chat)

    result = service.answer(repository_id=1, question="anything")

    assert result.citations == []
    assert "indexed" in result.answer.lower()
    assert chat.last_user_prompt is None  # LLM not invoked when there is no context


def test_citations_are_deduplicated_by_function():
    store = FakeStore([_hit(1, "app/api.py"), _hit(1, "app/api.py")])
    service = ChatService(embedder=FakeEmbedder(), store=store, chat=FakeChat())

    result = service.answer(repository_id=1, question="q")
    assert len(result.citations) == 1


class FakeStreamingChat(FakeChat):
    def stream(self, system_prompt: str, user_prompt: str):
        self.last_user_prompt = user_prompt
        yield "The handler "
        yield "validates."


def test_answer_stream_yields_tokens_then_citations():
    store = FakeStore([_hit(1, "app/main.py")])
    service = ChatService(embedder=FakeEmbedder(), store=store, chat=FakeStreamingChat())

    chunks = list(service.answer_stream(7, "what happens?"))

    texts = [c.text for c in chunks if c.text is not None]
    assert "".join(texts) == "The handler validates."
    # Citations come last, once, describing the whole answer.
    assert chunks[-1].text is None
    assert [c.file_path for c in chunks[-1].citations] == ["app/main.py"]


def test_answer_stream_retrieves_before_the_first_token():
    store = FakeStore([_hit(1, "app/main.py")])
    chat = FakeStreamingChat()
    service = ChatService(embedder=FakeEmbedder(), store=store, chat=chat)

    stream = service.answer_stream(7, "what happens?")
    next(stream)  # pull only the first token

    assert store.searched == (7, 6)
    assert "Context:" in chat.last_user_prompt


def test_answer_stream_on_an_unindexed_repository_explains_itself():
    service = ChatService(embedder=FakeEmbedder(), store=FakeStore([]), chat=FakeStreamingChat())

    chunks = list(service.answer_stream(7, "anything?"))

    assert "finished indexing" in chunks[0].text
    assert chunks[-1].citations == []
