"""Anthropic (Claude) client with the same surface as ``OpenAIChat``."""

from __future__ import annotations

import json
from collections.abc import Iterator

import anthropic

from app.core.config import get_settings

_MAX_TOKENS = 16000

# Classifier declines are re-run server-side on the model Anthropic recommends
# for that refusal category, instead of coming back to us as empty answers.
_FALLBACK = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}

_JSON_ONLY = "\n\nRespond with a single JSON object and nothing else - no prose, no code fences."


class ModelRefusalError(RuntimeError):
    """The model (and its fallback) declined to answer."""


class AnthropicChat:
    def __init__(self, client: anthropic.Anthropic | None = None) -> None:
        settings = get_settings()
        self._model = settings.llm_model
        self._effort = settings.llm_effort
        self._client = client or anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def _params(self, system_prompt: str, user_prompt: str) -> dict:
        return {
            "model": self._model,
            "max_tokens": _MAX_TOKENS,
            "output_config": {"effort": self._effort},
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
            **_FALLBACK,
        }

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """Return the assistant's reply for a single-turn system+user prompt."""
        response = self._client.beta.messages.create(**self._params(system_prompt, user_prompt))
        if response.stop_reason == "refusal":
            raise ModelRefusalError("The model declined to answer this request.")
        return "".join(block.text for block in response.content if block.type == "text")

    def stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]:
        """Yield the assistant's reply one text delta at a time."""
        with self._client.beta.messages.stream(**self._params(system_prompt, user_prompt)) as s:
            yield from s.text_stream

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Return a parsed JSON object; Claude has no JSON mode, so the prompt asks for one."""
        text = self.complete(system_prompt + _JSON_ONLY, user_prompt).strip()
        # Tolerate a fenced reply despite the instruction.
        start, end = text.find("{"), text.rfind("}")
        return json.loads(text[start : end + 1]) if start != -1 and end > start else {}
