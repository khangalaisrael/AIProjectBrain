"""OpenAI chat-completion client for the RAG answer step."""

from __future__ import annotations

from openai import OpenAI

from app.core.config import get_settings


class OpenAIChat:
    def __init__(self, client: OpenAI | None = None) -> None:
        settings = get_settings()
        self._model = settings.llm_model
        self._client = client or OpenAI(api_key=settings.openai_api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """Return the assistant's reply for a single-turn system+user prompt."""
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content or ""
