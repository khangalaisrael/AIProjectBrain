"""The Claude chat client, against a stand-in SDK client."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.infrastructure.llm.anthropic_chat import AnthropicChat, ModelRefusalError


def _text(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


class FakeMessages:
    def __init__(self, content: list, stop_reason: str = "end_turn") -> None:
        self.response = SimpleNamespace(content=content, stop_reason=stop_reason)
        self.calls: list[dict] = []

    def create(self, **params):
        self.calls.append(params)
        return self.response


def _chat(content: list, stop_reason: str = "end_turn") -> tuple[AnthropicChat, FakeMessages]:
    messages = FakeMessages(content, stop_reason)
    client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
    return AnthropicChat(client=client), messages


def test_complete_joins_text_and_skips_thinking() -> None:
    chat, messages = _chat(
        [SimpleNamespace(type="thinking", thinking=""), _text("Hi "), _text("there")]
    )
    assert chat.complete("sys", "user") == "Hi there"
    params = messages.calls[0]
    assert params["system"] == "sys"
    assert params["messages"] == [{"role": "user", "content": "user"}]
    assert params["fallbacks"] == "default"
    assert "temperature" not in params


def test_refusal_raises() -> None:
    chat, _ = _chat([], stop_reason="refusal")
    with pytest.raises(ModelRefusalError):
        chat.complete("sys", "user")


def test_complete_json_tolerates_code_fences() -> None:
    chat, messages = _chat([_text('```json\n{"title": "x"}\n```')])
    assert chat.complete_json("sys", "user") == {"title": "x"}
    assert "JSON object" in messages.calls[0]["system"]
