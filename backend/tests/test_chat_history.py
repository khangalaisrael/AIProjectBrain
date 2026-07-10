"""Chat persistence and the streamed (SSE) answer."""

from __future__ import annotations

import json

import pytest

from app.application.chat_service import ChatChunk, Citation
from app.infrastructure.db.models import RepositoryModel
from app.main import app
from app.presentation.dependencies import get_chat_service

CITATION = Citation(file_path="app/main.py", name="handle", start_line=1, end_line=9)


class FakeChatService:
    """Stands in for the RAG service; no embedder, no vector store, no OpenAI."""

    def __init__(self, deltas: list[str] | None = None, boom: bool = False) -> None:
        self._deltas = deltas if deltas is not None else ["Hel", "lo"]
        self._boom = boom

    def answer(self, repository_id: int, question: str):
        from app.application.chat_service import ChatAnswer

        return ChatAnswer(answer="".join(self._deltas), citations=[CITATION])

    def answer_stream(self, repository_id: int, question: str):
        for delta in self._deltas:
            yield ChatChunk(text=delta)
        if self._boom:
            raise RuntimeError("upstream exploded")
        yield ChatChunk(citations=[CITATION])


@pytest.fixture
def repo(db_session, user) -> RepositoryModel:
    model = RepositoryModel(
        user_id=user.id,
        github_id=1,
        name="brain",
        full_name="octocat/brain",
        clone_url="https://github.com/octocat/brain.git",
        default_branch="main",
    )
    db_session.add(model)
    db_session.commit()
    db_session.refresh(model)
    return model


@pytest.fixture
def fake_chat():
    service = FakeChatService()
    app.dependency_overrides[get_chat_service] = lambda: service
    yield service
    app.dependency_overrides.pop(get_chat_service, None)


def _events(response) -> list[dict]:
    """Parse an SSE body into its JSON payloads."""
    return [
        json.loads(line[len("data: ") :])
        for line in response.text.split("\n\n")
        if line.startswith("data: ")
    ]


# ---- history ----


def test_thread_starts_empty(client, auth_headers, repo):
    response = client.get(f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_asking_persists_both_turns(client, auth_headers, repo, fake_chat):
    client.post(
        f"/api/v1/repositories/{repo.id}/chat",
        json={"question": "what does it do?"},
        headers=auth_headers,
    )

    messages = client.get(
        f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers
    ).json()
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[0]["content"] == "what does it do?"
    assert messages[1]["content"] == "Hello"
    assert messages[1]["citations"][0]["file_path"] == "app/main.py"
    # A user turn carries no citations.
    assert messages[0]["citations"] == []


def test_history_is_ordered_oldest_first(client, auth_headers, repo, fake_chat):
    for question in ("first", "second"):
        client.post(
            f"/api/v1/repositories/{repo.id}/chat",
            json={"question": question},
            headers=auth_headers,
        )

    messages = client.get(
        f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers
    ).json()
    assert [m["content"] for m in messages if m["role"] == "user"] == ["first", "second"]
    assert [m["id"] for m in messages] == sorted(m["id"] for m in messages)


def test_clearing_the_thread_empties_it(client, auth_headers, repo, fake_chat):
    client.post(
        f"/api/v1/repositories/{repo.id}/chat", json={"question": "hi"}, headers=auth_headers
    )

    deleted = client.delete(f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers)
    assert deleted.status_code == 204

    messages = client.get(
        f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers
    ).json()
    assert messages == []


def test_history_on_unowned_repo_is_404(client, auth_headers, db_session, user):
    other = RepositoryModel(
        user_id=user.id + 999,
        github_id=2,
        name="theirs",
        full_name="someone/theirs",
        clone_url="https://github.com/someone/theirs.git",
        default_branch="main",
    )
    db_session.add(other)
    db_session.commit()

    response = client.get(f"/api/v1/repositories/{other.id}/chat/messages", headers=auth_headers)
    assert response.status_code == 404


def test_history_requires_authentication(client, repo):
    assert client.get(f"/api/v1/repositories/{repo.id}/chat/messages").status_code == 401


# ---- streaming ----


def test_stream_emits_tokens_then_citations_then_done(client, auth_headers, repo, fake_chat):
    response = client.post(
        f"/api/v1/repositories/{repo.id}/chat/stream",
        json={"question": "explain"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = _events(response)
    assert [e["type"] for e in events] == ["token", "token", "citations", "done"]
    assert "".join(e["text"] for e in events if e["type"] == "token") == "Hello"
    assert events[2]["citations"][0]["name"] == "handle"
    assert isinstance(events[3]["message_id"], int)


def test_stream_persists_the_whole_answer(client, auth_headers, repo, fake_chat):
    client.post(
        f"/api/v1/repositories/{repo.id}/chat/stream",
        json={"question": "explain"},
        headers=auth_headers,
    )

    messages = client.get(
        f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers
    ).json()
    assert [m["role"] for m in messages] == ["user", "assistant"]
    # The deltas are reassembled, not stored one row per token.
    assert messages[1]["content"] == "Hello"
    assert messages[1]["citations"][0]["start_line"] == 1


def test_stream_failure_reports_an_error_event_and_keeps_partial_text(client, auth_headers, repo):
    service = FakeChatService(deltas=["par", "tial"], boom=True)
    app.dependency_overrides[get_chat_service] = lambda: service
    try:
        response = client.post(
            f"/api/v1/repositories/{repo.id}/chat/stream",
            json={"question": "explain"},
            headers=auth_headers,
        )
        events = _events(response)
        assert [e["type"] for e in events] == ["token", "token", "error"]
        assert "upstream exploded" in events[-1]["message"]

        messages = client.get(
            f"/api/v1/repositories/{repo.id}/chat/messages", headers=auth_headers
        ).json()
        # The question and whatever text arrived are both still there.
        assert [m["role"] for m in messages] == ["user", "assistant"]
        assert messages[1]["content"] == "partial"
    finally:
        app.dependency_overrides.pop(get_chat_service, None)


def test_stream_on_unowned_repo_is_404(client, auth_headers, db_session, user, fake_chat):
    other = RepositoryModel(
        user_id=user.id + 999,
        github_id=3,
        name="theirs",
        full_name="someone/theirs",
        clone_url="https://github.com/someone/theirs.git",
        default_branch="main",
    )
    db_session.add(other)
    db_session.commit()

    response = client.post(
        f"/api/v1/repositories/{other.id}/chat/stream",
        json={"question": "explain"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_stream_rejects_an_empty_question(client, auth_headers, repo, fake_chat):
    response = client.post(
        f"/api/v1/repositories/{repo.id}/chat/stream", json={"question": ""}, headers=auth_headers
    )
    assert response.status_code == 422
