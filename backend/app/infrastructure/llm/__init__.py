"""Chat-model clients, chosen by ``LLM_PROVIDER``."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Protocol

from app.core.config import get_settings


class ChatModel(Protocol):
    def complete(self, system_prompt: str, user_prompt: str) -> str: ...

    def stream(self, system_prompt: str, user_prompt: str) -> Iterator[str]: ...

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict: ...


def make_chat() -> ChatModel:
    """Build the configured chat client (``anthropic`` or ``openai``)."""
    if get_settings().llm_provider == "openai":
        from app.infrastructure.llm.openai_chat import OpenAIChat

        return OpenAIChat()
    from app.infrastructure.llm.anthropic_chat import AnthropicChat

    return AnthropicChat()
