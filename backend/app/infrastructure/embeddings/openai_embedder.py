"""OpenAI embedding client.

Wraps the OpenAI embeddings API so the rest of the app depends only on plain
vectors, never on the SDK.
"""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings

# Keep each request under the model's input limit; batch large jobs.
_BATCH_SIZE = 128


class OpenAIEmbedder:
    def __init__(self, client: OpenAI | None = None) -> None:
        settings = get_settings()
        self._model = settings.embedding_model
        self._client = client or OpenAI(api_key=settings.openai_api_key)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text (order preserved)."""
        vectors: list[list[float]] = []
        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            response = self._client.embeddings.create(model=self._model, input=batch)
            vectors.extend(item.embedding for item in response.data)
        return vectors

    def embed_one(self, text: str) -> list[float]:
        return self.embed([text])[0]
