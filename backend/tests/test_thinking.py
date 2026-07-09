"""Developer Thinking endpoint tests (GitHub + LLM mocked)."""

import pytest

from app.domain.enums import ImportStatus
from app.infrastructure.db.models import RepositoryModel, UserModel

_DECISIONS = {
    "decisions": [
        {
            "decision": "Use the Repository pattern for data access",
            "reason": "Keeps SQLAlchemy queries out of services.",
            "tradeoffs": "Adds an indirection layer.",
            "alternatives": "Query the session directly in services.",
        },
        {
            "decision": "Store embeddings in Qdrant",
            "reason": "Purpose-built vector search.",
            "tradeoffs": "Another service to operate.",
            "alternatives": "pgvector inside Postgres.",
        },
    ]
}


class FakeGitHub:
    async def get_file_content(self, token, full_name, path, ref=None) -> str:
        return "# Demo project"


class FakeChat:
    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        return _DECISIONS


@pytest.fixture
def mock_clients(monkeypatch):
    monkeypatch.setattr("app.application.thinking_service.GitHubClient", lambda: FakeGitHub())
    monkeypatch.setattr("app.application.thinking_service.OpenAIChat", lambda: FakeChat())


@pytest.fixture
def repo_id(db_session, user: UserModel) -> int:
    repo = RepositoryModel(
        user_id=user.id,
        github_id=999,
        name="demo",
        full_name="octocat/demo",
        clone_url="https://github.com/octocat/demo.git",
        default_branch="main",
        status=ImportStatus.READY,
    )
    db_session.add(repo)
    db_session.commit()
    return repo.id


def test_decisions_empty_before_generation(client, auth_headers, repo_id):
    resp = client.get(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_generate_decisions_then_list_ordered(client, auth_headers, repo_id, mock_clients):
    gen = client.post(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    assert gen.status_code == 200
    items = gen.json()
    assert [d["order_index"] for d in items] == [0, 1]
    assert items[0]["decision"].startswith("Use the Repository pattern")
    assert items[0]["tradeoffs"] == "Adds an indirection layer."
    assert items[1]["alternatives"] == "pgvector inside Postgres."

    got = client.get(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    assert [d["decision"] for d in got.json()] == [d["decision"] for d in items]


def test_regenerate_replaces_previous_decisions(client, auth_headers, repo_id, mock_clients):
    client.post(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    client.post(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    got = client.get(f"/api/v1/repositories/{repo_id}/decisions", headers=auth_headers)
    assert len(got.json()) == 2  # replaced, not appended


def test_decisions_on_unowned_repo_is_404(client, auth_headers):
    resp = client.get("/api/v1/repositories/4321/decisions", headers=auth_headers)
    assert resp.status_code == 404


def test_decisions_require_auth(client):
    assert client.get("/api/v1/repositories/1/decisions").status_code in (401, 403)
