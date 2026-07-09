"""Repository import/listing tests (GitHub client + task queue mocked)."""

import pytest

_GITHUB_REPO = {
    "id": 1,
    "name": "demo",
    "full_name": "octocat/demo",
    "description": "A demo repo",
    "language": "Python",
    "private": False,
    "default_branch": "main",
    "clone_url": "https://github.com/octocat/demo.git",
}


_PUBLIC_REPO = {
    "id": 42,
    "name": "requests",
    "full_name": "psf/requests",
    "description": "HTTP for Humans",
    "language": "Python",
    "private": False,
    "default_branch": "main",
    "clone_url": "https://github.com/psf/requests.git",
    "stargazers_count": 52000,
}


class FakeGitHubClient:
    async def list_repositories(self, token: str, per_page: int = 100) -> list[dict]:
        return [_GITHUB_REPO]

    async def get_repository(self, token: str, full_name: str) -> dict:
        return {**_GITHUB_REPO, "full_name": full_name}

    async def search_repositories(self, token: str, query: str, per_page: int = 25) -> list[dict]:
        return [_PUBLIC_REPO] if query else []


@pytest.fixture
def mock_github(monkeypatch):
    monkeypatch.setattr(
        "app.application.repository_service.GitHubClient", lambda: FakeGitHubClient()
    )


@pytest.fixture
def enqueued(monkeypatch):
    """Capture indexing enqueue calls instead of hitting Celery/Redis."""
    calls: list[int] = []
    monkeypatch.setattr("app.application.repository_service._default_enqueue_index", calls.append)
    return calls


def test_list_github_repositories(client, auth_headers, mock_github):
    response = client.get("/api/v1/repositories/github", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["full_name"] == "octocat/demo"


def test_import_repository_creates_record_and_queues_indexing(
    client, auth_headers, mock_github, enqueued
):
    response = client.post(
        "/api/v1/repositories",
        headers=auth_headers,
        json={"full_name": "octocat/demo"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["full_name"] == "octocat/demo"
    assert body["status"] == "pending"
    assert enqueued == [body["id"]]


def test_import_is_idempotent(client, auth_headers, mock_github, enqueued):
    first = client.post(
        "/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"}
    )
    second = client.post(
        "/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"}
    )
    assert first.json()["id"] == second.json()["id"]
    assert len(enqueued) == 1  # only queued on first import


def test_list_imported_repositories(client, auth_headers, mock_github, enqueued):
    client.post("/api/v1/repositories", headers=auth_headers, json={"full_name": "octocat/demo"})
    response = client.get("/api/v1/repositories", headers=auth_headers)
    assert response.status_code == 200
    assert [r["full_name"] for r in response.json()] == ["octocat/demo"]


def test_repositories_require_auth(client):
    assert client.get("/api/v1/repositories").status_code in (401, 403)


def test_search_public_repositories(client, auth_headers, mock_github):
    resp = client.get("/api/v1/repositories/search", params={"q": "requests"}, headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["full_name"] == "psf/requests"
    assert body[0]["stars"] == 52000


def test_search_requires_a_query(client, auth_headers, mock_github):
    assert client.get("/api/v1/repositories/search", headers=auth_headers).status_code == 422


def test_search_requires_auth(client):
    assert client.get("/api/v1/repositories/search", params={"q": "x"}).status_code in (401, 403)


def test_can_import_a_public_repo_not_owned_by_user(client, auth_headers, mock_github, enqueued):
    """Importing works for any owner/name, not just the user's own repos."""
    resp = client.post(
        "/api/v1/repositories", headers=auth_headers, json={"full_name": "psf/requests"}
    )
    assert resp.status_code == 201
    assert resp.json()["full_name"] == "psf/requests"
    assert len(enqueued) == 1


def _import_repo(client, headers) -> int:
    resp = client.post("/api/v1/repositories", headers=headers, json={"full_name": "octocat/demo"})
    return resp.json()["id"]


def test_chat_returns_answer_and_citations(
    client, auth_headers, mock_github, enqueued, monkeypatch
):
    from app.application.chat_service import ChatAnswer, Citation

    repo_id = _import_repo(client, auth_headers)

    class FakeChatService:
        def answer(self, repository_id: int, question: str) -> ChatAnswer:
            assert repository_id == repo_id
            return ChatAnswer(
                answer="It handles requests.",
                citations=[Citation("app/api.py", "handle", 1, 9)],
            )

    monkeypatch.setattr(
        "app.presentation.api.v1.repositories.ChatService", lambda: FakeChatService()
    )

    response = client.post(
        f"/api/v1/repositories/{repo_id}/chat",
        headers=auth_headers,
        json={"question": "What does the API do?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "It handles requests."
    assert body["citations"][0]["file_path"] == "app/api.py"


def test_chat_on_unknown_repo_is_404(client, auth_headers):
    response = client.post(
        "/api/v1/repositories/9999/chat",
        headers=auth_headers,
        json={"question": "hi"},
    )
    assert response.status_code == 404


def test_chat_requires_auth(client):
    assert client.post("/api/v1/repositories/1/chat", json={"question": "hi"}).status_code in (
        401,
        403,
    )
