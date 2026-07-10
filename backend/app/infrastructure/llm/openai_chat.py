"""OpenAI chat-completion client for the RAG answer step."""

from __future__ import annotations

import json
from collections.abc import Iterator

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

    def stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        """Yield the assistant's reply one delta at a time.

        A delta is whatever the API sends — often a word fragment, sometimes an
        empty keep-alive chunk with no choices. The caller concatenates.
        """
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.1,
            stream=True,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Return a parsed JSON object using the model's JSON output mode."""
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        return json.loads(response.choices[0].message.content or "{}")
