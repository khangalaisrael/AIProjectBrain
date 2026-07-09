"""Retrieval-Augmented Generation over a repository's indexed code."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.infrastructure.embeddings.openai_embedder import OpenAIEmbedder
from app.infrastructure.llm.openai_chat import OpenAIChat
from app.infrastructure.vector.qdrant_store import QdrantVectorStore

_SYSTEM_PROMPT = (
    "You are a software engineering mentor helping a developer understand a "
    "codebase. Answer the question using ONLY the code snippets provided as "
    "context. Cite the files you rely on by their path. If the context does not "
    "contain the answer, say so plainly instead of guessing."
)


@dataclass(slots=True)
class Citation:
    file_path: str
    name: str
    start_line: int
    end_line: int


@dataclass(slots=True)
class ChatAnswer:
    answer: str
    citations: list[Citation]


class ChatService:
    def __init__(
        self,
        embedder: OpenAIEmbedder | None = None,
        store: QdrantVectorStore | None = None,
        chat: OpenAIChat | None = None,
    ) -> None:
        self._embedder = embedder or OpenAIEmbedder()
        self._store = store or QdrantVectorStore()
        self._chat = chat or OpenAIChat()

    def answer(self, repository_id: int, question: str) -> ChatAnswer:
        settings = get_settings()
        query_vector = self._embedder.embed_one(question)
        hits = self._store.search(query_vector, repository_id, settings.rag_top_k)

        if not hits:
            return ChatAnswer(
                answer=(
                    "I couldn't find any indexed code for this repository yet. "
                    "Make sure it has finished indexing, then try again."
                ),
                citations=[],
            )

        context = _build_context(hits)
        user_prompt = f"Question: {question}\n\nContext:\n{context}"
        answer = self._chat.complete(_SYSTEM_PROMPT, user_prompt)

        return ChatAnswer(answer=answer, citations=_citations(hits))


def _build_context(hits) -> str:
    blocks = []
    for hit in hits:
        p = hit.payload
        blocks.append(
            f"File: {p.get('file_path')} "
            f"(function {p.get('name')}, lines {p.get('start_line')}-{p.get('end_line')})\n"
            f"```\n{p.get('code', '')}\n```"
        )
    return "\n\n".join(blocks)


def _citations(hits) -> list[Citation]:
    seen: set[int] = set()
    citations: list[Citation] = []
    for hit in hits:
        p = hit.payload
        fid = p.get("function_id")
        if fid in seen:
            continue
        seen.add(fid)
        citations.append(
            Citation(
                file_path=p.get("file_path", ""),
                name=p.get("name", ""),
                start_line=p.get("start_line", 0),
                end_line=p.get("end_line", 0),
            )
        )
    return citations
